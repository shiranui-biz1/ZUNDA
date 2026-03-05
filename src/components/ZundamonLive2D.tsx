"use client";

import { useEffect, useRef } from "react";

const MODEL_PATH = "/live2d/zundamon/zundamon.model3.json";
const CANVAS_W = 280;
const CANVAS_H = 360;

type Props = {
  isSpeaking: boolean;
  replyText?: string;
};

const TAG_TO_EXPRESSION: Record<string, string> = {
  happy: "BrushFace",
  shy: "BrushFace",
  surprised: "ShockEye",
  sad: "Tear2",
  confused: "GuruguruEye",
  excited: "StarEye",
};

type EmotionTag = "happy" | "shy" | "surprised" | "sad" | "confused" | "excited" | "neutral";

function detectEmotionTag(text: string): EmotionTag {
  const match = text.match(/^\[(happy|shy|surprised|sad|confused|excited|neutral)\]/);
  return (match?.[1] as EmotionTag) ?? "neutral";
}

function detectExpression(text: string): string | null {
  const tag = detectEmotionTag(text);
  return TAG_TO_EXPRESSION[tag] ?? null;
}

export default function ZundamonLive2D({ isSpeaking, replyText = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<any>(null);
  const appRef = useRef<any>(null);
  const speakingRef = useRef(isSpeaking);
  const emotionRef = useRef<EmotionTag>("neutral");
  const currentExpressionRef = useRef<string | null>(null);

  useEffect(() => {
    speakingRef.current = isSpeaking;

    if (!isSpeaking && modelRef.current && currentExpressionRef.current) {
      const mgr = modelRef.current.internalModel?.motionManager?.expressionManager;
      if (mgr) {
        mgr.resetExpression();
      }
      currentExpressionRef.current = null;
      emotionRef.current = "neutral";
    }
  }, [isSpeaking]);

  useEffect(() => {
    if (!replyText || !modelRef.current) return;
    emotionRef.current = detectEmotionTag(replyText);
    const expr = detectExpression(replyText);
    if (expr) {
      modelRef.current.expression(expr);
      currentExpressionRef.current = expr;
    }
  }, [replyText]);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      await waitForCubismCore();

      const PIXI = await import("pixi.js");
      const { Live2DModel } = await import("pixi-live2d-display/cubism4");

      Live2DModel.registerTicker(PIXI.Ticker);

      if (destroyed || !containerRef.current) return;

      const app = new PIXI.Application({
        backgroundAlpha: 0,
        autoStart: true,
        width: CANVAS_W,
        height: CANVAS_H,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      appRef.current = app;
      containerRef.current.appendChild(app.view as HTMLCanvasElement);

      try {
        const model = await Live2DModel.from(MODEL_PATH, {
          autoInteract: false,
        });
        if (destroyed) {
          model.destroy();
          return;
        }
        modelRef.current = model;
        const internalModel = model.internalModel as any;
        const coreModel = internalModel.coreModel;

        // focusController の角度上書きを無効化
        internalModel.updateFocus = () => {};

        // 腰から上を拡大表示
        const baseScale = Math.min(CANVAS_W / model.width, CANVAS_H / model.height);
        const zoom = baseScale * 2.2;
        model.anchor.set(0.5, 0.5);
        model.scale.set(zoom);
        model.x = CANVAS_W / 2;
        model.y = CANVAS_H / 2 + model.height * zoom * 2.5;

        app.stage.addChild(model as any);

        let mouthElapsed = 0;
        let blinkTimer = 0;
        let nextBlink = randomBlinkInterval();
        let blinkPhase = 0;
        let bodyElapsed = 0;
        let speakStartTime = 0;

        // beforeModelUpdate: model.update() の直前に発火 → 確実に描画に反映
        internalModel.on("beforeModelUpdate", () => {
          const speaking = speakingRef.current;
          const emotion = emotionRef.current;
          const dt = app.ticker.deltaMS / 1000;

          bodyElapsed += dt;

          // --- 感情に応じた体の動き ---
          if (speaking) {
            let headX = 0, headY = 0, headZ = 0, breath = 0.5;
            const t = bodyElapsed;

            switch (emotion) {
              case "excited":
                // ブンブン大きく揺れる
                headX = Math.sin(t * 4.5) * 30;
                headY = Math.sin(t * 3.5) * 25 + Math.abs(Math.sin(t * 5.0)) * 10;
                headZ = Math.sin(t * 2.5) * 20;
                breath = (Math.sin(t * 5.0) + 1) / 2;
                break;
              case "happy":
                // リズミカルに弾む
                headX = Math.sin(t * 3.0) * 25;
                headY = Math.abs(Math.sin(t * 2.5)) * 20;
                headZ = Math.sin(t * 2.0) * 18;
                breath = (Math.sin(t * 3.5) + 1) / 2;
                break;
              case "shy":
                // うつむいてモジモジ
                headX = Math.sin(t * 1.5) * 18;
                headY = -20 + Math.sin(t * 1.0) * 8;
                headZ = Math.sin(t * 2.0) * 22;
                breath = (Math.sin(t * 2.5) + 1) / 2 * 0.6;
                break;
              case "sad":
                // 大きくうつむいてゆっくり
                headX = Math.sin(t * 0.6) * 15;
                headY = -25 + Math.sin(t * 0.5) * 8;
                headZ = Math.sin(t * 0.4) * 10;
                breath = (Math.sin(t * 1.5) + 1) / 2 * 0.4;
                break;
              case "surprised": {
                // ビクッと大きく仰け反る→震え
                const elapsed = t - speakStartTime;
                headX = Math.sin(elapsed * 10.0) * 30 * Math.max(0, 1 - elapsed * 0.15);
                headY = 30 * Math.max(0, 1 - elapsed * 0.6) + Math.sin(t * 3.0) * 12;
                headZ = Math.sin(elapsed * 8.0) * 20 * Math.max(0, 1 - elapsed * 0.15);
                breath = (Math.sin(t * 5.0) + 1) / 2;
                break;
              }
              case "confused":
                // 大きく首をかしげる
                headX = Math.sin(t * 1.0) * 18;
                headY = Math.sin(t * 0.8) * 12;
                headZ = 28 + Math.sin(t * 0.6) * 10;
                breath = (Math.sin(t * 2.5) + 1) / 2 * 0.5;
                break;
              default:
                // 普通に揺れる
                headX = Math.sin(t * 1.8) * 20;
                headY = Math.sin(t * 1.2) * 15;
                headZ = Math.sin(t * 1.0) * 12;
                breath = (Math.sin(t * 2.5) + 1) / 2;
            }

            coreModel.setParameterValueById("ParamAngleX", headX);
            coreModel.setParameterValueById("ParamAngleY", headY);
            coreModel.setParameterValueById("ParamAngleZ", headZ);
            coreModel.setParameterValueById("ParamBreath", breath);
          } else {
            coreModel.setParameterValueById("ParamAngleX", 0);
            coreModel.setParameterValueById("ParamAngleY", 0);
            coreModel.setParameterValueById("ParamAngleZ", 0);
            coreModel.setParameterValueById("ParamBreath",
              (Math.sin(bodyElapsed * 1.2) + 1) / 2 * 0.3);
            speakStartTime = bodyElapsed;
          }

          // 目線は正面
          coreModel.setParameterValueById("ParamEyeBallX", 0);
          coreModel.setParameterValueById("ParamEyeBallY", 0);

          // --- 口パク ---
          if (speaking) {
            mouthElapsed += dt * 60;
            const v =
              Math.sin(mouthElapsed * 0.5) * 0.35 +
              Math.sin(mouthElapsed * 0.8) * 0.25 +
              0.4;
            coreModel.setParameterValueById("ParamMouthOpenY",
              Math.max(0, Math.min(1, v)));
          } else {
            mouthElapsed = 0;
            coreModel.setParameterValueById("ParamMouthOpenY", 0);
          }

          // --- 自動まばたき ---
          blinkTimer += dt;
          if (blinkPhase > 0) {
            blinkPhase += dt;
            if (blinkPhase < 0.06) {
              const bt = blinkPhase / 0.06;
              coreModel.setParameterValueById("ParamEyeLOpen", 1 - bt);
              coreModel.setParameterValueById("ParamEyeROpen", 1 - bt);
            } else if (blinkPhase < 0.12) {
              const bt = (blinkPhase - 0.06) / 0.06;
              coreModel.setParameterValueById("ParamEyeLOpen", bt);
              coreModel.setParameterValueById("ParamEyeROpen", bt);
            } else {
              coreModel.setParameterValueById("ParamEyeLOpen", 1);
              coreModel.setParameterValueById("ParamEyeROpen", 1);
              blinkPhase = 0;
              blinkTimer = 0;
              nextBlink = randomBlinkInterval();
            }
          } else if (blinkTimer >= nextBlink) {
            blinkPhase = 0.001;
          }
        });
      } catch (err) {
        console.error("Live2D モデルの読み込みに失敗:", err);
      }
    }

    init();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      modelRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center"
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        filter: "saturate(0.7)",
        maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
      }}
    />
  );
}

function randomBlinkInterval() {
  return 2 + Math.random() * 4;
}

function waitForCubismCore(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Live2DCubismCore) {
      resolve();
      return;
    }
    const start = Date.now();
    const check = setInterval(() => {
      if ((window as any).Live2DCubismCore) {
        clearInterval(check);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(check);
        reject(
          new Error(
            "Live2DCubismCore が見つかりません。public/live2d/live2dcubismcore.min.js を配置してください。"
          )
        );
      }
    }, 100);
  });
}
