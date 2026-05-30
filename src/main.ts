import { FullWeatherSimulator } from './WeatherSimulator.ts';

// 修正：document.ready = () => { ... } から以下に変更
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('weatherCanvas') as HTMLCanvasElement;
  if (!canvas) return;

  const simulator = new FullWeatherSimulator(canvas);

  const btnHigh = document.getElementById('btnHigh') as HTMLButtonElement;
  const btnLow = document.getElementById('btnLow') as HTMLButtonElement;

  btnHigh.addEventListener('click', () => {
    simulator.currentMode = 'HIGH';
    btnHigh.className = 'active high';
    btnLow.className = 'low';
  });

  btnLow.addEventListener('click', () => {
    simulator.currentMode = 'LOW';
    btnHigh.className = 'high';
    btnLow.className = 'active low';
  });

  // アニメーションループ
  function loop() {
    simulator.update();
    simulator.draw();
    requestAnimationFrame(loop);
  }
  
  loop();
}); // 閉じカッコの修正もお忘れなく！