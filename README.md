# 🛡️ AuthentiCheck: Deep Writing Analysis & Authorship Forensics

AuthentiCheck is a sophisticated, browser-based tool designed to analyze the entire process of text creation. It goes far beyond a simple plagiarism check by capturing and visualizing detailed user behavior, including typing speed, rhythm, correction patterns, and the distinction between typed and pasted content.

This project is currently a **fully client-side application** that uses `localStorage` for data persistence, making it a powerful standalone demo.

**[➡️ View Live Demo](https://tejas36026.github.io/authenticheck/track.html)** *(This link will work after setting up GitHub Pages)*

---

## ✨ Key Features

*   **Typed vs. Pasted Analysis:** Visually distinguishes between content that was typed by the user and content that was pasted from an external source.
*   **Sentence-by-Sentence Forensics:** Breaks down the entire text into sentences and analyzes each one for:
    *   Typing Speed (WPM)
    *   Time taken to write
    *   Number of corrections (backspaces, deletes)
*   **Live Statistics:** A real-time stats bar shows session time, character counts, paste counts, and average typing speed.
*   **Interactive Dashboard:** A comprehensive dashboard that aggregates all session data and visualizes it with interactive charts, showing:
    *   Overall text composition (Typed vs. Pasted)
    *   Activity trends over time
    *   Per-sentence WPM, duration, and correction analysis
*   **Themeable UI:** Includes multiple themes (AuthentiCheck Dark, Light, Dark, Blue Neon) for a personalized user experience.
*   **Zero Backend Required:** Runs entirely in the browser, making it easy to deploy and test.

---

## 🛠️ Technology Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
*   **Data Visualization:** [Chart.js](https://www.chartjs.org/)
*   **QR Code Generation:** [kjua.js](https://github.com/lrsjng/kjua)
*   **Data Storage:** Browser `localStorage`

---

## 🏛️ How It Works (Architecture)

AuthentiCheck's brilliance lies in its client-side architecture:

1.  **Tracking (`track.html` & `main.js`):** As the user types in the editor, `main.js` listens for every keystroke, paste, and deletion. It logs these events with timestamps and categorizes text segments.
2.  **Data Persistence:** All this detailed session data, including sentence-level stats, is saved into the browser's `localStorage` under the key `studentTrackingDataAll`.
3.  **Visualization (`dashboard.html` & `dashboard.js`):** The dashboard page reads the entire history from `localStorage`, processes it, and uses Chart.js to render the analytics.

This self-contained model makes it perfect for demos, but would require a backend for a multi-user, production environment.

---

## 📂 File Structure

| File               | Description                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `index.html`       | A marketing-style landing page describing the product's capabilities.                                         |
| `track.html`       | The core application page with the text editor where user activity is tracked.                                |
| `main.js`          | The heart of the application. Contains all the logic for tracking typing, pasting, and sentence analysis.     |
| `dashboard.html`   | The analysis dashboard page that contains all the charts and metrics.                                         |
| `dashboard.js`     | The script that loads data from `localStorage`, performs calculations, and renders all the charts.            |

---

## 🚀 How to Run Locally

Since this project has no backend, you can run it easily with any local web server.

**Method 1: Using VS Code Live Server (Easiest)**

1.  Open the project folder in [Visual Studio Code](https://code.visualstudio.com/).
2.  Install the **Live Server** extension from the marketplace.
3.  Right-click on `index.html` or `track.html` in the file explorer and select **"Open with Live Server"**.

**Method 2: Using Python**

1.  Make sure you have Python installed.
2.  Open a terminal in the project's root directory.
3.  Run the command: `python -m http.server`
4.  Open your browser and navigate to `http://localhost:8000`.

---

## 📋 How to Use

1.  Navigate to `track.html`.
2.  Start typing in the text area. You can also paste content and make corrections.
3.  Observe the live statistics at the bottom of the editor.
4.  When you are finished, click the **"Analysis"** button.
5.  A modal will open showing the detailed dashboard with analytics of your writing session.
6.  You can go back, type more, and re-open the analysis to see the updated data.

---

## 🛣️ Future Improvements (Roadmap)

This project has a fantastic foundation. Here's how it could be evolved into a full-fledged SaaS product:

*   **Backend Integration:**
    *   Replace `localStorage` with a proper backend (e.g., Node.js/Express).
    *   Use a database (like PostgreSQL or MongoDB) to store user and session data.
    *   Implement user authentication to separate data from different users.
*   **Real-time Proctor Dashboard:**
    *   Use WebSockets (e.g., Socket.IO) to stream data from `track.html` to the dashboard in real-time, allowing a proctor to monitor multiple users simultaneously.
*   **Advanced Analysis:**
    *   Integrate Natural Language Processing (NLP) libraries to analyze the *quality* of the writing (e.g., grammar, tone, complexity).

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.
