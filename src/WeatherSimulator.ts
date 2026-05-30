// 1. 型定義
interface PressureSystem {
    x: number;
    y: number;
    intensity: number; // 正：高気圧、負：低気圧
    radius: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
}

type PlacementMode = 'HIGH' | 'LOW';

// Marching Squares 用のルックアップテーブル
const MARCHING_TABLE: number[][] = [
    [],              // 0
    [3, 2],          // 1
    [2, 1],          // 2
    [3, 1],          // 3
    [1, 0],          // 4
    [3, 0, 2, 1],    // 5
    [2, 0],          // 6
    [3, 0],          // 7
    [0, 3],          // 8
    [0, 2],          // 9
    [0, 1, 2, 3],    // 10
    [0, 1],          // 11
    [1, 3],          // 12
    [1, 2],          // 13
    [2, 3],          // 14
    []               // 15
];

export class FullWeatherSimulator {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width: number;
    private height: number;

    // シミュレーションデータ
    private systems: PressureSystem[] = [];
    private particles: Particle[] = [];
    
    // 温度グリッド
    private cellSize: number = 10;
    private cols: number;
    private rows: number;
    private temperatureGrid: number[][];
    private nextTemperatureGrid: number[][];

    // インタラクティブ状態
    public currentMode: PlacementMode = 'HIGH';
    private draggedSystem: PressureSystem | null = null;
    private dragOffsetX: number = 0;
    private dragOffsetY: number = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Could not get 2D context");
        this.ctx = context;

        this.width = canvas.width;
        this.height = canvas.height;
        this.cols = Math.floor(this.width / this.cellSize);
        this.rows = Math.floor(this.height / this.cellSize);

        // グリッド配列の初期化
        this.temperatureGrid = Array(this.cols).fill(0).map(() => Array(this.rows).fill(0));
        this.nextTemperatureGrid = Array(this.cols).fill(0).map(() => Array(this.rows).fill(0));

        this.init();
    }

    private init() {
        // 初期気圧配置（西高東低のシミュレート）
        this.systems = [
            { x: this.width * 0.25, y: this.height * 0.4, intensity: 45, radius: 280 }, // 高気圧
            { x: this.width * 0.75, y: this.height * 0.45, intensity: -55, radius: 320 } // 低気圧
        ];

        // 初期温度配置（北が寒く、南が暖かい）
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                const ratio = y / this.rows;
                this.temperatureGrid[x][y] = 10 + ratio * 15; // 10℃〜25℃
            }
        }

        // 風の粒子初期化
        for (let i = 0; i < 250; i++) {
            this.particles.push(this.createParticle());
        }

        // マウスイベント設定
        this.setupEventListeners();
    }

    private createParticle(): Particle {
        return {
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            vx: 0,
            vy: 0,
            life: Math.random() * 80 + 40
        };
    }

    // 任意の座標の気圧を計算
    public getPressureAt(x: number, y: number): number {
        let basePressure = 1013; 
        for (const sys of this.systems) {
            const dx = x - sys.x;
            const dy = y - sys.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < sys.radius) {
                const factor = (1 + Math.cos((dist / sys.radius) * Math.PI)) / 2;
                basePressure += sys.intensity * factor;
            }
        }
        return basePressure;
    }

    // 任意の座標の風速ベクトルを計算（気圧傾度力 + コリオリの力）
    public getWindAt(x: number, y: number): { vx: number; vy: number } {
        const delta = 3;
        const pX1 = this.getPressureAt(x - delta, y);
        const pX2 = this.getPressureAt(x + delta, y);
        const pY1 = this.getPressureAt(x, y - delta);
        const pY2 = this.getPressureAt(x, y + delta);

        const gradX = -(pX2 - pX1) / (delta * 2);
        const gradY = -(pY2 - pY1) / (delta * 2);

        const coriolisFactor = 0.85; 
        const vx = gradX * 6 + gradY * 6 * coriolisFactor;
        const vy = gradY * 6 - gradX * 6 * coriolisFactor;

        return { vx, vy };
    }

    // マウスイベントハンドラ
    private setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) return; 
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const clickedSystem = this.findSystemAt(mouseX, mouseY, 40);

            if (clickedSystem) {
                this.draggedSystem = clickedSystem;
                this.dragOffsetX = mouseX - clickedSystem.x;
                this.dragOffsetY = mouseY - clickedSystem.y;
            } else {
                const intensity = this.currentMode === 'HIGH' ? 45 : -55;
                const radius = this.currentMode === 'HIGH' ? 280 : 320;
                const newSystem = { x: mouseX, y: mouseY, intensity, radius };
                this.systems.push(newSystem);
                this.draggedSystem = newSystem;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.draggedSystem) return;
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            this.draggedSystem.x = Math.max(0, Math.min(this.width, mouseX - this.dragOffsetX));
            this.draggedSystem.y = Math.max(0, Math.min(this.height, mouseY - this.dragOffsetY));
        });

        window.addEventListener('mouseup', () => {
            this.draggedSystem = null;
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const targetSystem = this.findSystemAt(mouseX, mouseY, 40);
            if (targetSystem) {
                this.systems = this.systems.filter(sys => sys !== targetSystem);
            }
        });
    }

    private findSystemAt(x: number, y: number, maxDistance: number): PressureSystem | null {
        for (const sys of this.systems) {
            const dx = x - sys.x;
            const dy = y - sys.y;
            if (Math.sqrt(dx * dx + dy * dy) < maxDistance) return sys;
        }
        return null;
    }

    // 線形補間ヘルパー
    private lerp(p1: number, p2: number, isoValue: number): number {
        if (Math.abs(p1 - p2) < 0.00001) return 0.5;
        return (isoValue - p1) / (p2 - p1);
    }

    // 更新処理
    public update() {
        // 1. 風粒子の移動
        for (const p of this.particles) {
            const wind = this.getWindAt(p.x, p.y);
            p.vx = wind.vx;
            p.vy = wind.vy;
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.life <= 0 || p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) {
                Object.assign(p, this.createParticle());
            }
        }

        // 2. 気温の移流計算 (Semi-Lagrangian)
        for (let x = 1; x < this.cols - 1; x++) {
            for (let y = 1; y < this.rows - 1; y++) {
                const px = x * this.cellSize;
                const py = y * this.cellSize;
                const wind = this.getWindAt(px, py);

                const prevX = Math.max(0, Math.min(this.width - 1, px - wind.vx * 1.8));
                const prevY = Math.max(0, Math.min(this.height - 1, py - wind.vy * 1.8));

                const gX = Math.floor(prevX / this.cellSize);
                const gY = Math.floor(prevY / this.cellSize);

                this.nextTemperatureGrid[x][y] = this.temperatureGrid[gX][gY];
            }
        }
        // グリッドスワップ
        const temp = this.temperatureGrid;
        this.temperatureGrid = this.nextTemperatureGrid;
        this.nextTemperatureGrid = temp;
    }

    // 描画メイン
    public draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. 背景（温度グラデーション）
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                const t = this.temperatureGrid[x][y];
                // 10℃(青) 〜 25℃(赤) にマッピング
                const hue = 240 - ((t - 10) / 15) * 240; 
                this.ctx.fillStyle = `hsla(${hue}, 70%, 20%, 1)`; // 暗めの背景にして粒子を目立たせる
                this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
            }
        }

        // 2. Marching Squares による等圧線
        for (let iso = 960; iso <= 1040; iso += 4) {
            this.ctx.beginPath();
            if (iso % 20 === 0) {
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; // 20hPaごとの太線
            } else {
                this.ctx.lineWidth = 1;
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            }

            for (let x = 0; x < this.width - this.cellSize; x += this.cellSize) {
                for (let y = 0; y < this.height - this.cellSize; y += this.cellSize) {
                    const x0 = x, x1 = x + this.cellSize;
                    const y0 = y, y1 = y + this.cellSize;

                    const p0 = this.getPressureAt(x0, y0);
                    const p1 = this.getPressureAt(x1, y0);
                    const p2 = this.getPressureAt(x1, y1);
                    const p3 = this.getPressureAt(x0, y1);

                    let index = 0;
                    if (p0 >= iso) index |= 8;
                    if (p1 >= iso) index |= 4;
                    if (p2 >= iso) index |= 2;
                    if (p3 >= iso) index |= 1;

                    const edges = MARCHING_TABLE[index];
                    if (edges.length === 0) continue;

                    const pts: { x: number; y: number }[] = [
                        { x: x0 + this.cellSize * this.lerp(p0, p1, iso), y: y0 }, // 上
                        { x: x1, y: y0 + this.cellSize * this.lerp(p1, p2, iso) }, // 右
                        { x: x0 + this.cellSize * this.lerp(p3, p2, iso), y: y1 }, // 下
                        { x: x0, y: y0 + this.cellSize * this.lerp(p0, p3, iso) }  // 左
                    ];

                    for (let i = 0; i < edges.length; i += 2) {
                        const s = pts[edges[i]];
                        const e_pt = pts[edges[i + 1]];
                        if (s && e_pt) {
                            this.ctx.moveTo(s.x, s.y);
                            this.ctx.lineTo(e_pt.x, e_pt.y);
                        }
                    }
                }
            }
            this.ctx.stroke();
        }

        // 3. 自動前線生成の描画
        for (let x = 1; x < this.cols - 1; x++) {
            for (let y = 1; y < this.rows - 1; y++) {
                const gradT_x = (this.temperatureGrid[x + 1][y] - this.temperatureGrid[x - 1][y]) / 2;
                const gradT_y = (this.temperatureGrid[x][y + 1] - this.temperatureGrid[x][y - 1]) / 2;
                const magnitude = Math.sqrt(gradT_x * gradT_x + gradT_y * gradT_y);

                if (magnitude > 0.6) {
                    const px = x * this.cellSize;
                    const py = y * this.cellSize;
                    const wind = this.getWindAt(px, py);

                    this.ctx.lineWidth = 3;
                    if (wind.vy > 0.4 && gradT_x > 0) {
                        // 寒冷前線（青）
                        this.ctx.strokeStyle = "rgba(0, 100, 255, 0.8)";
                        this.ctx.beginPath(); this.ctx.moveTo(px, py); this.ctx.lineTo(px + this.cellSize, py); this.ctx.stroke();
                    } else if (wind.vy < -0.4 && gradT_x < 0) {
                        // 温暖前線（赤）
                        this.ctx.strokeStyle = "rgba(255, 50, 50, 0.8)";
                        this.ctx.beginPath(); this.ctx.moveTo(px, py); this.ctx.lineTo(px + this.cellSize, py); this.ctx.stroke();
                    }
                }
            }
        }

        // 4. 風粒子の描画
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
        for (const p of this.particles) {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // 5. 高気圧・低気圧マークの描画
        this.ctx.font = "bold 26px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        for (const sys of this.systems) {
            if (sys.intensity > 0) {
                this.ctx.fillStyle = "#ff4444";
                this.ctx.fillText("H", sys.x, sys.y);
            } else {
                this.ctx.fillStyle = "#4444ff";
                this.ctx.fillText("L", sys.x, sys.y);
            }
        }
    }
}