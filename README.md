# Dataset Evaluation & AI Reporting Platform

## 📋 Project Submission

**Project Name**: Dataset Evaluation & AI Reporting Platform
**Team Members**: Priyanshu Kumar, Kaustubh shandilya , Vinay BU
**Track**: AI / Data Analytics / Developer Tools

---

## 🚀 Project Overview
Data scientists spend 30–50% of their time manually inspecting and cleaning datasets. Critical issues like missing values, bias, duplication, and class imbalance often go unnoticed until model failure.

Our solution is a secure, AI-powered dataset evaluation platform that:

Automatically analyzes datasets for quality issues
Generates plain-language insights
Provides AI-based Q&A (RAG)
Stores dataset history for reuse
Exports professional PDF reports

## 🏗️ Architecture
- **Inference**: LlamaIndex + ChromaDB + Grok API (RAG-based AI insights & Q&A)
- **Data Pipeline**:Dataset Upload (CSV/Excel) → FastAPI → Polars EDA → Data Quality Metrics → Supabase Storage
- **Frontend**:Next.js 14 + React + TailwindCSS + Shadcn/UI + Recharts/Plotly Dashboard

## 📹 Demo
[Link to your Loom/YouTube demo or a GIF showing it in action.]

---

## ✅ Pre-Submission Checklist
- [ ] **Code Runs**: Everything in `/src` executes without error.
- [ ] **Dependencies**: All external libraries are listed in `requirements.txt`.
- [ ] **Environment**: Provided a `.env.example` if API keys are required.
- [ ] **Screenshots**: Added visual proof to the `/screenshots` folder.
- [ ] **Demo Instructions**: README clearly explains how to run the prototype.

---

## 🛠️ How to Run Locally
1. Clone this repo.
2. `pip install -r requirements.txt`
3. Add your keys to `.env`.
4. Run `python src/main.py`.
