# Project Architecture Overview

## 1. Architecture Summary

The application is built using a monolithic server-side rendered architecture based on **Flask (Python)**.
- **Frontend**: HTML5, CSS3 (Custom, no heavy framework like Bootstrap to keep it lightweight and ensure maximum flexibility), and Vanilla JavaScript. We utilize **MathJax** via CDN for rendering beautiful LaTeX mathematical formulas.
- **Backend**: Flask handles routing and form submissions. The core numerical method logic is implemented in standard Python, leveraging **SymPy** for symbolic mathematics (specifically parsing and calculating derivatives) and **NumPy/Matplotlib** for high-performance numerical operations and generating visualizations.
- **Hosting**: The project is structured and configured (`vercel.json`) to be deployed effortlessly on **Vercel** as serverless Python functions.

## 2. Safe Parsing of User Input

To implement the Newton-Raphson interactive calculator securely:
- **Challenge**: The application must parse arbitrary mathematical functions input by the user (e.g., `x**3 - x - 2`). Using Python's built-in `eval()` function is highly insecure and a major security risk (arbitrary code execution).
- **Solution**: We use **SymPy (`sympy.sympify`)** to parse the string input. SymPy safely converts the string into an abstract syntax tree representing the mathematical expression. It inherently restricts evaluation to mathematical operations, completely eliminating the risk of arbitrary code execution.
- **Differentiation**: Once parsed, we use SymPy's `diff()` function to calculate the exact symbolic derivative automatically. This means the user only has to input $f(x)$ instead of both $f(x)$ and $f'(x)$, vastly improving the user experience while preventing human error in manual differentiation.
- **Execution**: For the actual iterations, the symbolic expressions are compiled into fast numerical functions using SymPy's `lambdify` with the `math` and `numpy` modules, ensuring the iterative loop runs in milliseconds.

## 3. Screenshots (Placeholder)

> **Student Instruction**: Please replace these placeholders with actual screenshots of your running application before converting to PDF.

- **Discussion & Examples**: [Insert Screenshot of the top part of the page]
- **Interactive Calculator Input**: [Insert Screenshot of the form]
- **Calculator Results & Plot**: [Insert Screenshot of the results table and graph]

## 4. Advanced Features (Extra 10%)

To fulfill the criteria for extra points, the following advanced features were implemented:
1.  **Dynamic Visualizations (Plotting)**: Utilizing Matplotlib on the backend, the application dynamically generates a plot of the user's function and visually indicates the found root. The plot is seamlessly rendered on the frontend using base64 encoding, avoiding the need for temporary file storage.
2.  **Export Results**: A custom JavaScript feature allows the user to export the iteration history table as a clean CSV file, useful for further analysis or inclusion in reports.
3.  **Robust Error Handling**: The application gracefully handles and displays errors for zero derivatives (where the method fails), non-convergence (max iterations reached), and invalid mathematical syntax.
4.  **Premium Aesthetics**: A custom dark-mode, glassmorphism design system ensures a visually stunning and highly responsive user experience.

## 5. Vercel Deployment

**Deployment Steps**:
1. Push this repository to GitHub.
2. Log into [Vercel](https://vercel.com/) and create a new project.
3. Import the GitHub repository.
4. Vercel will automatically detect the `vercel.json` and deploy the Flask app.

**Vercel Link**: [Replace with your generated Vercel URL]
