/**
 * Prompt-to-Hardware & Firmware Engine
 * Generates physical circuit schematics, interactive SVG pinouts, and embedded firmware.
 */

export interface HardwarePinout {
  pinNumber: string;
  pinLabel: string;
  connectedTo: string;
  signalType: 'GPIO' | 'I2C' | 'SPI' | 'PWM' | 'ADC' | 'POWER' | 'GND';
}

export interface HardwareBomItem {
  partName: string;
  designator: string;
  quantity: number;
  specs: string;
}

export interface HardwareSchematicPackage {
  id: string;
  title: string;
  microcontroller: 'ESP32-S3' | 'Raspberry Pi Pico' | 'Arduino Uno R4' | 'STM32';
  svgSchematic: string;
  firmwareCode: string;
  firmwareLang: 'cpp_arduino' | 'micropython';
  bom: HardwareBomItem[];
  pinoutTable: HardwarePinout[];
  webControllerHtml: string;
  webControllerCss: string;
  createdAt: number;
}

/**
 * Synthesizes hardware blueprint and firmware from natural language
 */
export function synthesizeHardwareBlueprint(prompt: string): HardwareSchematicPackage {
  const p = prompt.toLowerCase();

  let title = 'IoT Sensor Telemetry Node';
  let mcu: HardwareSchematicPackage['microcontroller'] = 'ESP32-S3';
  let firmwareLang: HardwareSchematicPackage['firmwareLang'] = 'cpp_arduino';

  if (p.includes('pico') || p.includes('python')) {
    mcu = 'Raspberry Pi Pico';
    firmwareLang = 'micropython';
  } else if (p.includes('arduino') || p.includes('uno')) {
    mcu = 'Arduino Uno R4';
  }

  // Detect peripheral intent
  const hasDisplay = p.includes('screen') || p.includes('oled') || p.includes('display');
  const hasMotor = p.includes('motor') || p.includes('servo') || p.includes('stepper');
  const hasEncoder = p.includes('knob') || p.includes('dial') || p.includes('encoder') || p.includes('speed');

  if (hasEncoder && hasDisplay) {
    title = 'Tactical Rotary Telemetry Controller';
  } else if (hasMotor) {
    title = 'Closed-Loop Actuator Driver Board';
  } else {
    title = 'ESP32 Intelligent Environmental Node';
  }

  // Generate Interactive SVG Pinout Schematic
  const svgSchematic = `<svg viewBox="0 0 600 360" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background:#05070d; border-radius:12px;">
  <!-- Grid Background -->
  <defs>
    <pattern id="pcb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56,189,248,0.07)" stroke-width="1"/>
    </pattern>
    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect width="600" height="360" fill="url(#pcb-grid)" />

  <!-- MCU Board (ESP32) -->
  <rect x="50" y="60" width="160" height="240" rx="8" fill="#0d1527" stroke="#38bdf8" stroke-width="2" filter="url(#neon-glow)" />
  <text x="130" y="95" fill="#38bdf8" font-size="14" font-weight="bold" font-family="monospace" text-anchor="middle">${mcu}</text>
  <text x="130" y="115" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="middle">WiFi + BLE 5.0</text>
  <rect x="90" y="130" width="80" height="60" rx="4" fill="#020617" stroke="rgba(56,189,248,0.3)" />
  <text x="130" y="165" fill="#64748b" font-size="9" font-family="monospace" text-anchor="middle">XTENSA LX7</text>

  <!-- MCU Pins -->
  <circle cx="210" cy="140" r="5" fill="#38bdf8" />
  <text x="195" y="143" fill="#38bdf8" font-size="9" font-family="monospace" text-anchor="end">D21 (SDA)</text>
  <circle cx="210" cy="170" r="5" fill="#818cf8" />
  <text x="195" y="173" fill="#818cf8" font-size="9" font-family="monospace" text-anchor="end">D22 (SCL)</text>
  <circle cx="210" cy="200" r="5" fill="#10b981" />
  <text x="195" y="203" fill="#10b981" font-size="9" font-family="monospace" text-anchor="end">D4 (PWM)</text>
  <circle cx="210" cy="230" r="5" fill="#f43f5e" />
  <text x="195" y="233" fill="#f43f5e" font-size="9" font-family="monospace" text-anchor="end">3.3V</text>
  <circle cx="210" cy="260" r="5" fill="#475569" />
  <text x="195" y="263" fill="#64748b" font-size="9" font-family="monospace" text-anchor="end">GND</text>

  <!-- Peripheral Module (OLED 0.96 I2C) -->
  <rect x="380" y="50" width="170" height="110" rx="6" fill="#090f1d" stroke="#818cf8" stroke-width="1.5" />
  <text x="465" y="75" fill="#818cf8" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle">SSD1306 OLED (I2C)</text>
  <rect x="405" y="90" width="120" height="50" rx="3" fill="#000" stroke="#38bdf8" stroke-width="0.8" />
  <text x="465" y="120" fill="#38bdf8" font-size="11" font-family="monospace" text-anchor="middle">UI // 128x64</text>

  <!-- Peripheral Module 2 (Rotary / Sensor) -->
  <rect x="380" y="200" width="170" height="110" rx="6" fill="#090f1d" stroke="#10b981" stroke-width="1.5" />
  <text x="465" y="225" fill="#10b981" font-size="12" font-weight="bold" font-family="monospace" text-anchor="middle">OPTICAL ENCODER</text>
  <circle cx="465" cy="265" r="22" fill="#020617" stroke="#10b981" stroke-width="1.5" />
  <line x1="465" y1="265" x2="480" y2="250" stroke="#34d399" stroke-width="2" />

  <!-- PCB Traces / Signal Routing Lines -->
  <!-- SDA Trace -->
  <path d="M 210 140 H 320 V 95 H 380" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 2" />
  <!-- SCL Trace -->
  <path d="M 210 170 H 300 V 120 H 380" fill="none" stroke="#818cf8" stroke-width="2" stroke-dasharray="4 2" />
  <!-- Signal Trace to Encoder -->
  <path d="M 210 200 H 310 V 240 H 380" fill="none" stroke="#10b981" stroke-width="2" />
  <!-- Power Trace -->
  <path d="M 210 230 H 340 V 270 H 380" fill="none" stroke="#f43f5e" stroke-width="1.5" />
</svg>`;

  // Generate Embedded Firmware Code
  const firmwareCode = `// ========================================================
// ANTIGRAVITY EMBEDDED HARDWARE FIRMWARE
// Target: ${mcu} | Platform: Arduino C++ / ESP-IDF
// Blueprint: ${title}
// ========================================================

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define PIN_ENCODER_CLK 4
#define PIN_ENCODER_DT  5

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
volatile int counter = 0;
int lastStateCLK;

void IRAM_ATTR readEncoderISR() {
  int stateCLK = digitalRead(PIN_ENCODER_CLK);
  if (stateCLK != lastStateCLK) {
    if (digitalRead(PIN_ENCODER_DT) != stateCLK) {
      counter++;
    } else {
      counter--;
    }
  }
  lastStateCLK = stateCLK;
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22); // SDA = 21, SCL = 22

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for (;;);
  }

  pinMode(PIN_ENCODER_CLK, INPUT_PULLUP);
  pinMode(PIN_ENCODER_DT, INPUT_PULLUP);
  lastStateCLK = digitalRead(PIN_ENCODER_CLK);
  attachInterrupt(digitalPinToInterrupt(PIN_ENCODER_CLK), readEncoderISR, CHANGE);

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 10);
  display.println("ANTIGRAVITY HARDWARE");
  display.println("ENGINE READY");
  display.display();
}

void loop() {
  static int lastCounter = -1;
  if (counter != lastCounter) {
    lastCounter = counter;
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("TELEMETRY CHANNEL");
    display.setTextSize(2);
    display.setCursor(10, 25);
    display.print("VAL: ");
    display.print(counter);
    display.display();
    Serial.printf("{\\"encoder\\": %d, \\"status\\": \\"OK\\"}\\n", counter);
  }
  delay(10);
}`;

  const bom: HardwareBomItem[] = [
    { partName: mcu, designator: 'U1', quantity: 1, specs: 'Dual Core Xtensa LX7, 8MB PSRAM' },
    { partName: '0.96" I2C Monochrome OLED', designator: 'DISP1', quantity: 1, specs: '128x64px SSD1306 3.3V' },
    { partName: 'Rotary Encoder EC11', designator: 'ENC1', quantity: 1, specs: '20 Pulses/Rev, Integrated Pushbutton' },
    { partName: 'Pull-up Resistors 10kΩ', designator: 'R1, R2', quantity: 2, specs: '0805 SMD / 1/4W Through-hole' },
  ];

  const pinoutTable: HardwarePinout[] = [
    { pinNumber: 'GPIO 21', pinLabel: 'SDA', connectedTo: 'OLED Display (Pin 4)', signalType: 'I2C' },
    { pinNumber: 'GPIO 22', pinLabel: 'SCL', connectedTo: 'OLED Display (Pin 3)', signalType: 'I2C' },
    { pinNumber: 'GPIO 4', pinLabel: 'ENC_CLK', connectedTo: 'Encoder Channel A', signalType: 'GPIO' },
    { pinNumber: 'GPIO 5', pinLabel: 'ENC_DT', connectedTo: 'Encoder Channel B', signalType: 'GPIO' },
    { pinNumber: '3.3V', pinLabel: 'VCC', connectedTo: 'All Peripheral Rails', signalType: 'POWER' },
    { pinNumber: 'GND', pinLabel: 'GND', connectedTo: 'Common Ground Plane', signalType: 'GND' },
  ];

  const webControllerHtml = `<div class="hw-card">
  <div class="hw-header">
    <span class="mcu-badge">${mcu}</span>
    <span class="pulse-led"></span>
  </div>
  <div class="hw-title">${title}</div>
  <div class="hw-dial">
    <div class="dial-val">84.2</div>
    <div class="dial-unit">KHZ // FREQ</div>
  </div>
  <button class="btn-flash">FLASH FIRMWARE</button>
</div>`;

  const webControllerCss = `.hw-card {
  width: 280px;
  padding: 20px;
  background: #090e17;
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 16px;
  color: #fff;
  font-family: monospace;
  box-shadow: 0 0 25px rgba(56, 189, 248, 0.2);
}
.hw-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.mcu-badge {
  font-size: 10px;
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  padding: 2px 8px;
  border-radius: 6px;
}
.pulse-led {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 8px #10b981;
}
.hw-title {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 14px;
}
.hw-dial {
  text-align: center;
  padding: 16px;
  background: #03060a;
  border-radius: 12px;
  margin-bottom: 14px;
}
.dial-val {
  font-size: 26px;
  font-weight: bold;
  color: #38bdf8;
}
.dial-unit {
  font-size: 9px;
  color: #64748b;
}
.btn-flash {
  width: 100%;
  padding: 8px;
  background: #38bdf8;
  color: #000;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 11px;
  cursor: pointer;
}`;

  return {
    id: `hw-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    title,
    microcontroller: mcu,
    svgSchematic,
    firmwareCode,
    firmwareLang,
    bom,
    pinoutTable,
    webControllerHtml,
    webControllerCss,
    createdAt: Date.now(),
  };
}
