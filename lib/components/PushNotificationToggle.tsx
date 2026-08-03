"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, deletePushSubscription } from "@/app/(protected)/settings/actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Status = "checking" | "unsupported" | "enabled" | "disabled" | "denied";

export function PushNotificationToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? "enabled" : "disabled");
    }
    check().catch(() => setStatus("unsupported"));
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys) {
        throw new Error("通知の購読情報の取得に失敗しました");
      }
      await savePushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setStatus("enabled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "通知の有効化に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("disabled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "通知の解除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded border p-4">
      <p className="font-medium">通知</p>
      <p className="mt-1 text-sm text-gray-600">
        課題が更新されたとき（毎朝4時台）と、未提出の課題が残っている日の23時台に、この端末に通知します。
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {status === "checking" && <p className="mt-3 text-sm text-gray-500">確認中…</p>}
      {status === "unsupported" && (
        <p className="mt-3 text-sm text-gray-500">この端末・ブラウザは通知に対応していません。</p>
      )}
      {status === "denied" && (
        <p className="mt-3 text-sm text-red-600">
          通知がブロックされています。ブラウザの設定からこのサイトの通知を許可してください。
        </p>
      )}
      {status === "disabled" && (
        <button
          type="button"
          onClick={handleEnable}
          disabled={busy}
          className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          この端末で通知を有効にする
        </button>
      )}
      {status === "enabled" && (
        <div className="mt-3 flex items-center gap-3">
          <p className="text-sm text-green-700">この端末で通知は有効です</p>
          <button
            type="button"
            onClick={handleDisable}
            disabled={busy}
            className="rounded border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            無効にする
          </button>
        </div>
      )}
    </div>
  );
}
