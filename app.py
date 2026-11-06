
import os
import json
import joblib
import pandas as pd
import numpy as np

from flask import Flask, render_template, request, jsonify

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)

# Load trained ML model
model = joblib.load(
    os.path.join(BASE_DIR, "models/credit_model.pkl")
)

# Load feature schema
with open(
    os.path.join(BASE_DIR, "models/feature_schema.json")
) as f:
    schema = json.load(f)

# Load dataset
dataset = pd.read_csv(
    os.path.join(BASE_DIR, "dataset/credit_data.csv")
)

# Load model comparison
metrics = pd.read_csv(
    os.path.join(BASE_DIR, "models/model_comparison.csv")
)

# Load metadata
with open(
    os.path.join(BASE_DIR, "models/model_metadata.json")
) as f:
    metadata = json.load(f)

best_model_name = metadata["best_model"]

# SHAP background data
background = dataset[list(schema.keys())].sample(
    n=min(20, len(dataset)),
    random_state=42
)


def validate_applicant(data):

    applicant = {}

    for feature, rules in schema.items():

        if feature not in data:
            raise ValueError(f"Missing field: {feature}")

        value = data[feature]

        if rules["type"] == "number":

            value = float(value)

            if not np.isfinite(value):
                raise ValueError(f"Invalid value for {feature}")

            if not rules["min"] <= value <= rules["max"]:
                raise ValueError(f"Invalid value for {feature}")

        else:

            value = str(value)

            if value not in rules["options"]:
                raise ValueError(f"Invalid category for {feature}")

        applicant[feature] = value

    return pd.DataFrame(
        [applicant],
        columns=list(schema.keys())
    )


@app.route("/")
def home():
    return render_template("index.html", schema=schema)


@app.route("/api/analytics")
def analytics():

    risk = dataset["Credit_Risk"].astype(str).str.lower()

    return jsonify({
        "total_applicants": int(len(dataset)),
        "good_credit": int((risk == "good").sum()),
        "bad_credit": int((risk == "bad").sum()),
        "average_age": round(float(dataset["age"].mean()), 2),
        "average_credit_amount": round(
            float(dataset["credit_amount"].mean()), 2
        )
    })


@app.route("/api/metrics")
def model_metrics():
    return jsonify(metrics.to_dict(orient="records"))


@app.route("/api/schema")
def get_schema():
    return jsonify(schema)


@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.get_json(silent=True) or {}

        input_data = validate_applicant(data)

        prediction = int(model.predict(input_data)[0])

        probabilities = model.predict_proba(input_data)[0]

        return jsonify({
            "prediction": (
                "Bad Credit" if prediction == 1 else "Good Credit"
            ),
            "good_probability": round(
                float(probabilities[0]) * 100, 2
            ),
            "bad_probability": round(
                float(probabilities[1]) * 100, 2
            ),
            "risk_probability": round(
                float(probabilities[1]) * 100, 2
            ),
            "model": best_model_name,
            "notice": "Educational model estimate, not a lending decision."
        })

    except (ValueError, TypeError):
        return jsonify({
            "error": "Please enter valid applicant information."
        }), 400

    except Exception:

        app.logger.exception("Prediction error")

        return jsonify({
            "error": "Unable to generate prediction."
        }), 500


# ==========================================
# EXPLAINABLE AI - SHAP INTEGRATION
# ==========================================

@app.route("/api/explain", methods=["POST"])
def explain_prediction():

    try:

        import shap

        data = request.get_json(silent=True) or {}

        input_data = validate_applicant(data)

        # Create SHAP explainer
        explainer = shap.Explainer(
            model.predict_proba,
            background,
            algorithm="permutation"
        )

        # Calculate SHAP values
        explanation = explainer(
            input_data,
            max_evals=(2 * len(schema) + 1) * 5
        )

        values = np.asarray(explanation.values)

        # Select Bad Credit class (class index 1)
        if values.ndim == 3:
            contributions = values[0, :, 1]
        elif values.ndim == 2:
            contributions = values[0]
        else:
            raise ValueError("Unexpected SHAP output shape")

        contributions = np.asarray(
            contributions,
            dtype=float
        )

        # Generate feature explanations
        results = []

        for index, feature in enumerate(schema.keys()):

            contribution = float(contributions[index])

            results.append({
                "feature": feature.replace("_", " ").title(),
                "value": str(input_data.iloc[0][feature]),
                "contribution": round(contribution, 5),
                "impact": (
                    "Increases Bad Credit score"
                    if contribution > 0
                    else "Reduces Bad Credit score"
                )
            })

        # Sort by strongest absolute contribution
        results.sort(
            key=lambda x: abs(x["contribution"]),
            reverse=True
        )

        probabilities = model.predict_proba(input_data)[0]

        return jsonify({

            "success": True,

            "prediction": (
                "Bad Credit"
                if int(model.predict(input_data)[0]) == 1
                else "Good Credit"
            ),

            "bad_credit_probability": round(
                float(probabilities[1]) * 100, 2
            ),

            "top_factors": results[:5],

            "all_features": results,

            "explanation": (
                "Positive SHAP contributions increase "
                "the model's Bad Credit probability, "
                "while negative contributions decrease it."
            ),

            "method": "SHAP Permutation Explainer",

            "model": best_model_name

        })

    except (ValueError, TypeError):
        return jsonify({
            "error": "Invalid applicant information."
        }), 400

    except Exception:

        app.logger.exception("SHAP explanation error")

        return jsonify({
            "error": "Unable to generate SHAP explanation."
        }), 500


if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )
