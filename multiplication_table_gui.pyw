# -*- coding: utf-8 -*-
"""九九乘法表 —— 图形界面版（tkinter）
双击运行本文件(.pyw)不会出现黑色控制台窗口，直接显示彩色表格窗口。
"""
import tkinter as tk

ROWS = 9
# 每一行的背景颜色
COLORS = [
    "#e17055", "#fdcb6e", "#00b894", "#00cec9",
    "#0984e3", "#6c5ce7", "#e84393", "#d63031", "#2d3436",
]

root = tk.Tk()
root.title("九九乘法表")
root.configure(bg="#dfe6e9")

# 标题
tk.Label(
    root, text="九九乘法表", font=("Microsoft YaHei", 24, "bold"),
    bg="#dfe6e9", fg="#2d3436",
).grid(row=0, column=0, columnspan=10, pady=(20, 12))

# 表头：1 ~ 9
tk.Label(
    root, text="", font=("Microsoft YaHei", 12, "bold"),
    bg="#2d3436", width=3, padx=2, pady=4,
).grid(row=1, column=0, padx=2, pady=2)
for c in range(1, 10):
    tk.Label(
        root, text=str(c), font=("Microsoft YaHei", 12, "bold"),
        bg="#2d3436", fg="white", width=8, padx=2, pady=4,
    ).grid(row=1, column=c, padx=2, pady=2)

# 乘法表内容
for i in range(1, 10):
    # 行首标号
    tk.Label(
        root, text=str(i), font=("Microsoft YaHei", 12, "bold"),
        bg="#2d3436", fg="white", width=3, padx=2, pady=4,
    ).grid(row=i + 1, column=0, padx=2, pady=2)

    for j in range(1, i + 1):
        tk.Label(
            root, text=f"{j}×{i}={i * j}",
            font=("Consolas", 12),
            bg=COLORS[(i - 1) % len(COLORS)],
            fg="white", width=8, padx=2, pady=6,
        ).grid(row=i + 1, column=j, padx=2, pady=2)

# 让窗口居中显示
root.update_idletasks()
w = root.winfo_width()
h = root.winfo_height()
x = (root.winfo_screenwidth() - w) // 2
y = (root.winfo_screenheight() - h) // 3
root.geometry(f"+{x}+{y}")

root.mainloop()
