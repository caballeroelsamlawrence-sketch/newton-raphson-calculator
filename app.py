import re
from flask import Flask, render_template, request, jsonify
import sympy as sp
from functools import lru_cache

app = Flask(__name__)

def preprocess_expression(expr_str):
    """Auto-corrects common syntax mistakes."""
    expr_str = expr_str.replace('^', '**')
    expr_str = re.sub(r'(\d)([a-zA-Z\(])', r'\1*\2', expr_str) # 2x -> 2*x, 2(x) -> 2*(x)
    return expr_str

def generate_steps(func_expr, deriv_expr, x_history, f_vals, df_vals):
    steps = []
    func_latex = sp.printing.latex(func_expr)
    deriv_latex = sp.printing.latex(deriv_expr)
    
    steps.append({
        'title': '1. Function & Derivative',
        'content': f"<ul><li>\\( f(x) = {func_latex} \\)</li><li>\\( f'(x) = {deriv_latex} \\)</li></ul>"
    })
    
    steps.append({
        'title': '2. Iteration Formula',
        'content': f"\\[ x_{{n+1}} = x_n - \\frac{{{func_latex}}}{{{deriv_latex}}} \\]"
    })
    
    num_steps = min(3, len(f_vals))
    if num_steps > 0:
        iter_list = "<ul>"
        for i in range(num_steps):
            x_curr = x_history[i]
            x_next = x_history[i+1]
            f_curr = f_vals[i]
            df_curr = df_vals[i]
            
            x_c_str = f"{x_curr:.6f}".rstrip('0').rstrip('.') if '.' in f"{x_curr:.6f}" else f"{x_curr}"
            f_c_str = f"{f_curr:.6f}".rstrip('0').rstrip('.') if '.' in f"{f_curr:.6f}" else f"{f_curr}"
            df_c_str = f"{df_curr:.6f}".rstrip('0').rstrip('.') if '.' in f"{df_curr:.6f}" else f"{df_curr}"
            x_n_str = f"{x_next:.6f}".rstrip('0').rstrip('.') if '.' in f"{x_next:.6f}" else f"{x_next}"
            
            step_latex = r"\( x_{{{}}} = {} - \frac{{{}}}{{{}}} \approx {} \)".format(
                i+1, x_c_str, f_c_str, df_c_str, x_n_str
            )
            iter_list += f"<li><strong>Iteration {i+1}:</strong> {step_latex}</li>"
            
        iter_list += "</ul>"
        steps.append({
            'title': f"3. Iterations (Starting with \\( x_0 = {x_history[0]} \\))",
            'content': iter_list
        })
        
    return steps

@lru_cache(maxsize=128)
def cached_calculate(func_str_raw, x0_str, tol_str, max_iter_str):
    x = sp.Symbol('x')
    error_msg = None
    results = []
    root = None
    steps_html = []
    desmos_func = ""
    history_arr = []
    
    try:
        # Preprocess string
        func_str = preprocess_expression(func_str_raw)
        
        func_expr = sp.sympify(func_str)
        deriv_expr = sp.diff(func_expr, x)
        desmos_func = str(func_expr).replace('**', '^')
        
        x0 = float(x0_str)
        tol = float(tol_str)
        max_iter = int(max_iter_str)
        
        f_val_func = sp.lambdify(x, func_expr, 'math')
        f_deriv_func = sp.lambdify(x, deriv_expr, 'math')
        
        x_n = x0
        x_history = [x_n]
        f_vals = []
        df_vals = []
        
        for i in range(max_iter + 1):
            f_n = f_val_func(x_n)
            df_n = f_deriv_func(x_n)
            
            f_vals.append(f_n)
            df_vals.append(df_n)
            history_arr.append(x_n)
            
            results.append({
                'iter': i,
                'x': x_n,
                'f_x': f_n,
                'df_x': df_n,
                'error': abs(f_n)
            })
            
            if abs(f_n) < tol:
                root = x_n
                break
                
            if df_n == 0:
                error_msg = f"Derivative is zero at iteration {i}. Method fails."
                break
                
            if i == max_iter:
                error_msg = f"Failed to converge after {max_iter} iterations."
                break
                
            x_n = x_n - f_n / df_n
            x_history.append(x_n)
            
        steps_html = generate_steps(func_expr, deriv_expr, x_history, f_vals, df_vals)
        return {
            'success': True,
            'results': results,
            'root': root,
            'error_msg': error_msg,
            'steps': steps_html,
            'desmos_func': desmos_func,
            'history_arr': history_arr,
            'func_str': func_str
        }
    except Exception as e:
        return {
            'success': False,
            'error_msg': f"Error evaluating function: {str(e)}. Please check syntax.",
            'func_str': func_str_raw
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    data = request.json
    func_str = data.get('function', '')
    x0_str = data.get('x0', '1')
    tol_str = data.get('tolerance', '1e-6')
    max_iter_str = data.get('max_iter', '50')
    
    result = cached_calculate(func_str, x0_str, tol_str, max_iter_str)
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)
