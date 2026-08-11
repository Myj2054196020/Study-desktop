# -*- coding: utf-8 -*-
"""打印 99 乘法表（九九乘法表）"""
import traceback


def main():
    for i in range(1, 10):
        for j in range(1, i + 1):
            # 每个式子占位对齐，结尾用制表符分隔
            print(f"{j}*{i}={i * j}", end="\t")
        print()  # 每行结束换行


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # 如果有错误，打印完整报错信息，避免窗口一闪而过看不到
        traceback.print_exc()
    finally:
        input("\n按回车键退出...")
