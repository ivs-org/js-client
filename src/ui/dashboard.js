/**
 * ui/dashboard.js - Бортовая панель (отладочная информация)
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { appState, setState, clearDashboardLogs, toggleDashboard } from '../core/app_state.js';

export function renderDashboard(state) {
    const dashboardEl = document.getElementById('dashboardPanel');
    
    if (!state.showDashboard) {
        if (dashboardEl) {
            dashboardEl.remove();
        }
        return;
    }
    
    if (!dashboardEl) {
        createDashboardElement();
    }
    
    updateDashboardContent();
}

function createDashboardElement() {
    const dashboard = document.createElement('div');
    dashboard.id = 'dashboardPanel';
    dashboard.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        width: 500px;
        max-height: 400px;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid #333;
        border-radius: 10px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 10px 10px 0 0;
        border-bottom: 1px solid #333;
    `;
    
    const title = document.createElement('span');
    title.textContent = '📊 Бортовая панель';
    title.style.cssText = `
        color: #00ff88;
        font-weight: bold;
        font-size: 14px;
    `;
    
    const buttons = document.createElement('div');
    buttons.style.cssText = `
        display: flex;
        gap: 8px;
    `;
    
    const clearBtn = createButton('🗑️ Очистить', () => clearDashboardLogs());
    const closeBtn = createButton('✕ Закрыть', () => toggleDashboard());
    
    buttons.appendChild(clearBtn);
    buttons.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(buttons);
    
    // Content (scrollable)
    const content = document.createElement('div');
    content.id = 'dashboardContent';
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 10px 15px;
        color: #0f0;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-all;
    `;
    
    // Scrollbar styling
    const style = document.createElement('style');
    style.textContent = `
        #dashboardContent::-webkit-scrollbar {
            width: 8px;
        }
        #dashboardContent::-webkit-scrollbar-track {
            background: #1a1a2e;
            border-radius: 4px;
        }
        #dashboardContent::-webkit-scrollbar-thumb {
            background: #00ff88;
            border-radius: 4px;
        }
        #dashboardContent::-webkit-scrollbar-thumb:hover {
            background: #00cc6a;
        }
    `;
    dashboard.appendChild(style);
    dashboard.appendChild(header);
    dashboard.appendChild(content);
    
    document.body.appendChild(dashboard);
    updateDashboardContent();
}

function createButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
        background: #00ff88;
        color: #000;
        border: none;
        padding: 5px 10px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 11px;
        font-weight: bold;
        transition: all 0.2s;
    `;
    btn.onmouseover = () => btn.style.background = '#00cc6a';
    btn.onmouseout = () => btn.style.background = '#00ff88';
    btn.onclick = onClick;
    return btn;
}

function updateDashboardContent() {
    const content = document.getElementById('dashboardContent');
    if (!content) return;
    
    const logs = appState.dashboardLogs || [];
    content.textContent = logs.join('\n') || '📭 Логи пусты';
    
    // Auto-scroll to bottom
    content.scrollTop = content.scrollHeight;
}

export function initDashboard() {
    // Подписка на изменения состояния
    const unsubscribe = () => {};
    return unsubscribe;
}
