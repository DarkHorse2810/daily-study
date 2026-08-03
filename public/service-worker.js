self.addEventListener("push", (event) => {
  let data = { title: "daily study", body: "" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    data = { title: "daily study", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "daily study", {
      body: data.body || "",
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(clients.openWindow(url));
});
