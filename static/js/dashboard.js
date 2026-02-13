async function fetchAlerts() {
    const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'Active')
        .order('created_at', { ascending: false });

    if (data) {
        const container = document.getElementById('alert-list');
        container.innerHTML = data.map(alert => `
            <div class="alert-card ${alert.type.toLowerCase()}">
                <h4>?? ${alert.type} DETECTED</h4>
                <p><strong>Source:</strong> ${alert.ip}</p>
                <div class="ai-remedy">
                    <strong>AI Suggestion:</strong> ${alert.remediation}
                </div>
                <button onclick="resolve('${alert.id}')">Execute & Close</button>
            </div>
        `).join('');
    }
}
setInterval(fetchAlerts, 3000); // Real-time poll every 3 seconds