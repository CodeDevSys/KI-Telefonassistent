(function refreshAppointments() {
  const tableBody = document.getElementById("appointments-body");
  const status = document.getElementById("refresh-status");

  if (!tableBody) {
    return;
  }

  async function loadAppointments() {
    try {
      const response = await fetch("/api/appointments", {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });

      if (response.status === 401) {
        window.location.href = "/login?error=Bitte%20melden%20Sie%20sich%20zuerst%20an.";
        return;
      }

      if (!response.ok) {
        throw new Error("Termine konnten nicht geladen werden.");
      }

      const data = await response.json();
      renderRows(data.appointments || []);
      updateStatus("Zuletzt aktualisiert: " + new Date().toLocaleTimeString("de-DE"));
    } catch (error) {
      updateStatus("Automatische Aktualisierung fehlgeschlagen. Neuer Versuch in 5 Sekunden.");
    }
  }

  function renderRows(appointments) {
    if (appointments.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" class="empty">Noch keine Termine vorhanden.</td></tr>';
      return;
    }

    tableBody.innerHTML = appointments
      .map(
        (appointment) => `
          <tr>
            <td>${escapeHtml(appointment.formattedDate)}</td>
            <td>${escapeHtml(appointment.time)}</td>
            <td>${escapeHtml(appointment.name)}</td>
            <td>${escapeHtml(appointment.phone)}</td>
            <td>${escapeHtml(appointment.service)}</td>
            <td>${escapeHtml(appointment.formattedCreatedAt)}</td>
          </tr>
        `
      )
      .join("");
  }

  function updateStatus(message) {
    if (status) {
      status.textContent = message;
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  loadAppointments();
  setInterval(loadAppointments, 5000);
})();
