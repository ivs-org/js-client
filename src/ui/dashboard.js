/**
 * ui/dashboard.js - Бортовая панель (приборная панель)
 *
 * Author: Anton Golovkov, golovkov@videograce.com
 * Copyright (C), Infinity Video Soft LLC, 2025
 */

import { appState, subscribe, clearDashboardLogs, toggleDashboard } from '../core/app_state.js';

let dashboardEl = null;
let metricsEl = null;
let updateInterval = null;

export function renderDashboard(state) {
    // Создаём или удаляем панель
    if (!state.showDashboard) {
        if (dashboardEl) {
            dashboardEl.remove();
            dashboardEl = null;
            metricsEl = null;
        }
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
        return;
    }
    
    // Создаём панель если ещё нет
    if (!dashboardEl) {
        createDashboardElement();
        startAutoUpdate();
    }
    
    // Обновляем контент
    updateDashboardContent(state);
}

export function initDashboard() {
    // Пустая функция для совместимости
}

function createDashboardElement() {
    const isMobile = window.innerWidth <= 600;
    
    dashboardEl = document.createElement('div');
    dashboardEl.id = 'dashboardPanel';
    dashboardEl.style.cssText = `
        position: fixed;
        bottom: ${isMobile ? '60px' : '10px'};
        left: 10px;
        right: ${isMobile ? '10px' : 'auto'};
        width: ${isMobile ? 'auto' : '600px'};
        max-width: ${isMobile ? 'calc(100vw - 20px)' : '600px'};
        max-height: 400px;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid #333;
        border-radius: 10px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: ${isMobile ? '11px' : '12px'};
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
        flex-shrink: 0;
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
    
    // Metrics content
    metricsEl = document.createElement('div');
    metricsEl.id = 'dashboardMetrics';
    metricsEl.style.cssText = `
        flex: 1;
        overflow-y: auto;
        overflow-x: auto;
        padding: 15px;
        color: #0f0;
        line-height: 1.6;
        white-space: nowrap;
        word-break: normal;
        min-height: 200px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: ${isMobile ? '11px' : '13px'};
    `;
    
    // Scrollbar styling
    const style = document.createElement('style');
    style.textContent = `
        #dashboardMetrics::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        #dashboardMetrics::-webkit-scrollbar-track {
            background: #1a1a2e;
            border-radius: 4px;
        }
        #dashboardMetrics::-webkit-scrollbar-thumb {
            background: #00ff88;
            border-radius: 4px;
        }
        #dashboardMetrics::-webkit-scrollbar-thumb:hover {
            background: #00cc6a;
        }
    `;
    dashboardEl.appendChild(style);
    dashboardEl.appendChild(header);
    dashboardEl.appendChild(metricsEl);
    
    document.body.appendChild(dashboardEl);
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

function updateDashboardContent(state) {
    if (!metricsEl) return;
    
    const logs = state.dashboardLogs || [];
    
    if (logs.length === 0) {
        metricsEl.textContent = '📭 Логи пусты\n\nВключите камеру/микрофон для отображения данных';
    } else {
        metricsEl.textContent = logs.join('\n');
    }
    
    // Auto-scroll to bottom
    setTimeout(() => {
        if (metricsEl) {
            metricsEl.scrollTop = metricsEl.scrollHeight;
        }
    }, 10);
}

function startAutoUpdate() {
    // Обновляем дашборд каждые 500мс
    updateInterval = setInterval(() => {
        if (metricsEl) {
            const metrics = collectMetrics();
            const logText = metrics.join('\n');
            
            // Получаем текущие логи
            const currentLogs = appState.dashboardLogs || [];
            
            // Если метрики отличаются от последних логов - добавляем
            const lastLog = currentLogs[currentLogs.length - 1] || '';
            if (!lastLog.includes('[METRICS]')) {
                // Добавляем текущие метрики как лог
                const timestamp = new Date().toLocaleTimeString();
                metrics.forEach(m => {
                    if (!currentLogs.some(l => l.includes(m.split(':')[0]))) {
                        // addDashboardLog(`[METRICS] ${m}`);
                    }
                });
            }
            
            // Обновляем отображение
            const allLogs = [...currentLogs, ...metrics.map(m => `[${new Date().toLocaleTimeString()}] ${m}`)];
            metricsEl.textContent = allLogs.slice(-50).join('\n');
            metricsEl.scrollTop = metricsEl.scrollHeight;
        }
    }, 500);
}

function collectMetrics() {
    const metrics = [];
    
    // WebCodecs статус
    metrics.push(`🎬 VideoDecoder: ${'VideoDecoder' in window ? '✓' : '✗'}`);
    metrics.push(`🎵 AudioDecoder: ${'AudioDecoder' in window ? '✓' : '✗'}`);
    metrics.push(`📹 VideoEncoder: ${'VideoEncoder' in window ? '✓' : '✗'}`);
    metrics.push(`🎤 AudioEncoder: ${'AudioEncoder' in window ? '✓' : '✗'}`);
    metrics.push(`🔁 MediaStreamTrackProcessor: ${'MediaStreamTrackProcessor' in window ? '✓' : '✗'}`);
    
    // SharedArrayBuffer
    const sabAvailable = typeof SharedArrayBuffer !== 'undefined';
    metrics.push(`💾 SharedArrayBuffer: ${sabAvailable ? '✓' : '✗'}`);
    
    // Secure Context
    metrics.push(`🔒 Secure Context: ${window.isSecureContext ? '✓' : '✗'}`);
    
    // Audio Context
    const audioCtx = window.AudioContext || window.webkitAudioContext;
    metrics.push(`🎧 AudioContext: ${audioCtx ? '✓' : '✗'}`);
    
    // Network
    if (navigator.connection) {
        metrics.push(`🌐 Network: ${navigator.connection.effectiveType || 'unknown'} (${navigator.connection.downlink || '?'} Mbps)`);
    }
    
    // Browser info
    metrics.push(`🌍 Browser: ${navigator.userAgent.split(' ').pop()}`);
    
    return metrics;
}
