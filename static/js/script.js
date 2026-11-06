
// ========================================
// AI CREDIT INTELLIGENCE - JAVASCRIPT
// ========================================

let creditChart = null;
let modelChart = null;


// ========================================
// 1. LOAD DASHBOARD ANALYTICS
// ========================================

async function loadAnalytics() {

    try {

        const response = await fetch("/api/analytics");

        if (!response.ok) {
            throw new Error("Analytics loading failed");
        }

        const data = await response.json();

        document.getElementById("totalApplicants").textContent =
            data.total_applicants.toLocaleString();

        document.getElementById("goodApplicants").textContent =
            data.good_credit.toLocaleString();

        document.getElementById("badApplicants").textContent =
            data.bad_credit.toLocaleString();

        createCreditChart(data);

    } catch (error) {

        console.error("Analytics error:", error);

    }

}


// ========================================
// 2. CREDIT DISTRIBUTION CHART
// ========================================

function createCreditChart(data) {

    const ctx = document.getElementById("creditChart");

    if (!ctx) return;

    if (creditChart) {
        creditChart.destroy();
    }

    creditChart = new Chart(ctx, {

        type: "doughnut",

        data: {

            labels: ["Good Credit", "Bad Credit"],

            datasets: [{

                data: [
                    data.good_credit,
                    data.bad_credit
                ],

                backgroundColor: [
                    "#35d6a0",
                    "#ff647c"
                ],

                borderWidth: 0,

                hoverOffset: 12

            }]

        },

        options: {

            responsive: true,

            plugins: {

                legend: {

                    position: "bottom",

                    labels: {
                        color: "#ffffff",
                        padding: 20
                    }

                }

            }

        }

    });

}


// ========================================
// 3. MODEL PERFORMANCE CHART
// ========================================

async function loadModelMetrics() {

    try {

        const response = await fetch("/api/metrics");

        if (!response.ok) {
            throw new Error("Metrics loading failed");
        }

        const models = await response.json();

        const ctx = document.getElementById("modelChart");

        if (!ctx) return;

        const modelNames = models.map(
            item => item.Model
        );

        const accuracy = models.map(
            item => item.Accuracy * 100
        );

        const f1Scores = models.map(
            item => item["F1 Score"] * 100
        );

        if (modelChart) {
            modelChart.destroy();
        }

        modelChart = new Chart(ctx, {

            type: "bar",

            data: {

                labels: modelNames,

                datasets: [

                    {

                        label: "Accuracy (%)",

                        data: accuracy,

                        backgroundColor: "#8657ff",

                        borderRadius: 8

                    },

                    {

                        label: "F1 Score (%)",

                        data: f1Scores,

                        backgroundColor: "#35d9ed",

                        borderRadius: 8

                    }

                ]

            },

            options: {

                responsive: true,

                scales: {

                    y: {

                        beginAtZero: true,

                        max: 100,

                        ticks: {
                            color: "#ffffff"
                        },

                        grid: {
                            color: "rgba(255,255,255,0.08)"
                        }

                    },

                    x: {

                        ticks: {
                            color: "#ffffff"
                        },

                        grid: {
                            display: false
                        }

                    }

                },

                plugins: {

                    legend: {

                        labels: {
                            color: "#ffffff"
                        }

                    }

                }

            }

        });

    } catch (error) {

        console.error("Model chart error:", error);

    }

}


// ========================================
// 4. CREDIT RISK PREDICTION
// ========================================

const predictionForm = document.getElementById(
    "predictionForm"
);

predictionForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const button = document.getElementById(
        "predictButton"
    );

    const resultCard = document.getElementById(
        "result"
    );

    button.disabled = true;

    button.textContent = "Analysing Applicant...";

    resultCard.classList.add("hidden");

    const formData = new FormData(predictionForm);

    const applicantData = {};

    formData.forEach((value, key) => {

        const input = predictionForm.elements[key];

        applicantData[key] = (
            input.type === "number"
        ) ? Number(value) : value;

    });

    try {

        const response = await fetch("/predict", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(applicantData)

        });

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.error || "Prediction failed"
            );

        }

        // Display prediction

        const predictionLabel = document.getElementById(
            "predictionLabel"
        );

        predictionLabel.textContent = data.prediction;

        predictionLabel.style.color = (
            data.prediction === "Good Credit"
        ) ? "#35d6a0" : "#ff647c";

        document.getElementById(
            "predictionDescription"
        ).textContent =
            data.prediction === "Good Credit"
            ? "The model classified this applicant as Good Credit."
            : "The model classified this applicant as Bad Credit.";

        // Display probabilities

        document.getElementById(
            "goodProbability"
        ).textContent = data.good_probability + "%";

        document.getElementById(
            "badProbability"
        ).textContent = data.bad_probability + "%";

        document.getElementById(
            "goodBar"
        ).style.width = data.good_probability + "%";

        document.getElementById(
            "badBar"
        ).style.width = data.bad_probability + "%";

        document.getElementById(
            "modelUsed"
        ).textContent = "Model: " + data.model;

        resultCard.classList.remove("hidden");

        resultCard.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

    } catch (error) {

        alert(error.message);

        console.error(error);

    } finally {

        button.disabled = false;

        button.textContent = "✦ Analyse Credit Risk";

    }

});


// ========================================
// 5. INITIALIZE DASHBOARD
// ========================================

document.addEventListener("DOMContentLoaded", function() {

    loadAnalytics();

    loadModelMetrics();

    console.log(
        "AI Credit Intelligence Dashboard Initialized"
    );

});
