@echo off
chcp 65001 >nul
cd /d E:\code\learning-desktop
echo ============================================
echo  Study desktop - 开发版启动器
echo  首次会先编译 Electron 主进程，然后打开应用窗口
echo  窗口弹出后，本窗口请保持打开（关闭会退出应用）
echo ============================================
npm run dev
pause
