// static/js/chat.js
(function () {

  if (typeof userId === "undefined" || !userId) {
    console.warn("chat.js: userId not defined; chat will not initialize.");
    return;
  }
  if (typeof supabaseClient === "undefined") {
    console.warn("chat.js: supabaseClient not defined; chat will not initialize.");
    return;
  }

  // DOM elements
  const usersUl = document.getElementById("usersUl");
  const chatTitle = document.getElementById("chatTitle");
  const chatBox = document.getElementById("chat-box");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");

  // Conversation state
  let receiverId = null;
  let receiverName = null;
  const displayedIds = new Set();



  // --- NEW HELPER FUNCTIONS ---

  /**
   * Checks if two date objects are on the same calendar day.
   */
  function isSameDay(date1, date2) {
    if (!date1 || !date2) return false;
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Formats a date for the separator (e.g., "Today", "Yesterday", "October 5, 2025").
   */
  function formatDateSeparator(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, today)) {
      return 'Today';
    }
    if (isSameDay(date, yesterday)) {
      return 'Yesterday';
    }
    // Default format for older dates
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Creates and appends a separator div to the chat box.
   */
  function appendSeparator(text, cssClass) {
    const sep = document.createElement('div');
    sep.className = 'chat-separator ' + (cssClass || '');
    sep.textContent = text;
    chatBox.appendChild(sep);
  }




  // --- Helper: Render a message (creates / updates element) ---
  function renderMessageRow(msg) {
    if (!msg || !msg.id) return;

    // If message already displayed => update status (ticks)
    const existingEl = chatBox.querySelector(`.chat-message[data-id="${msg.id}"]`);
    if (existingEl) {
      const ticks = existingEl.querySelector(".ticks");
      if (ticks) {
        const oldStatus = ticks.dataset.status;
        if (oldStatus === 'read') return; // Don't downgrade status

        const newStatus = msg.status;
        ticks.textContent = newStatus === "read" ? "✔✔" : "✔";
        ticks.classList.toggle("blue", newStatus === "read");
        ticks.dataset.status = newStatus;
      }
      return;
    }

    // Create new message element
    const div = document.createElement("div");
    div.className = "chat-message " + (msg.sender_id === userId ? "sent" : "received");
    div.dataset.id = msg.id;

    const ticks = msg.status === "read" ? "✔✔" : "✔";
    const tickClass = msg.status === "read" ? "ticks blue" : "ticks";

    div.innerHTML = `
      <div class="bubble">
        <p>${escapeHtml(msg.message)}</p>
        <span class="meta">
          <span class="time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          ${msg.sender_id === userId ? `<span class="${tickClass}" data-status="${msg.status}">${ticks}</span>` : ''}
        </span>
      </div>
    `;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    displayedIds.add(String(msg.id));
  }

  function escapeHtml(s) {
    if (!s) return "";
    return s.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  // --- API Calls ---

 
// newloadmessages
// In static/js/chat.js
// REPLACE your old loadMessages function with this one

async function loadMessages() {
    if (!receiverId) return;

    try {
        const resp = await fetch(`/api/messages/${userId}/${receiverId}`);
        const json = await resp.json();
        if (!json.success) throw new Error(json.error);

        chatBox.innerHTML = ''; // Clear the chat box
        let lastMessageDate = null;
        let unreadIndicatorPlaced = false;

        // Loop through all messages to add separators
        for (const msg of json.messages) {
            const messageDate = new Date(msg.timestamp);

            // 3. LOGIC FOR "NEW MESSAGE" SEPARATOR
            // Check if this is the first unread message for me
            if (
                !unreadIndicatorPlaced &&
                msg.receiver_id === userId &&
                msg.status !== 'read'
            ) {
                appendSeparator('New Messages', 'unread-separator');
                unreadIndicatorPlaced = true;
            }

            // 2. LOGIC FOR DATE SEPARATOR
            // Check if this message is on a new day
            if (!isSameDay(lastMessageDate, messageDate)) {
                appendSeparator(formatDateSeparator(messageDate));
                lastMessageDate = messageDate;
            }

            // Render the actual message
            renderMessageRow(msg);
        }

        // Scroll to the bottom (or to the unread separator if it exists)
        const unreadEl = chatBox.querySelector('.unread-separator');
        if (unreadEl) {
            unreadEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        // Now, mark all messages as read *after* we've displayed them
        await markRead(receiverId);

    } catch (e) {
        console.error('loadMessages error:', e);
        chatBox.innerHTML = `<p class="error-msg">Error loading messages.</p>`;
    }
}

  async function sendMessage(e) {
    e.preventDefault();
    if (!receiverId) return alert("Please select a user to chat with.");
    
    const text = messageInput.value.trim();
    if (!text) return;
    
    // Optimistic UI: display message immediately with 'sent' status
    const tempMessage = {
        id: `temp-${Date.now()}`,
        sender_id: userId,
        receiver_id: receiverId,
        message: text,
        timestamp: new Date().toISOString(),
        status: 'sent'
    };
    renderMessageRow(tempMessage);
    messageInput.value = "";

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, recipient_id: receiverId })
      });
      const json = await res.json();
      
      // Replace temp message with actual message from server
      const tempEl = chatBox.querySelector(`[data-id="${tempMessage.id}"]`);
      if (tempEl) tempEl.remove();

      if (!json.success) {
        console.error("Send failed:", json.error);
        // Optionally, show an error indicator on the failed message
      } else {
        renderMessageRow(json.message_row);
      }
    } catch (err) {
      console.error("sendMessage error:", err);
    }
  }

  async function markDelivered(messageId) {
    if (!messageId) return;
    try {
      await fetch("/api/messages/delivered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId })
      });
    } catch (e) {
      console.error("markDelivered error", e);
    }
  }

  async function markRead(senderId) {
    if (!senderId) return;
    try {
      await fetch("/api/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender_id: senderId })
      });
    } catch (e) {
      console.error("markRead error", e);
    }
  }

// --- Real-time Subscription with Debugging ---
supabaseClient
  .channel('public:messages')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'messages' },
    (payload) => {
      console.log("--- Real-time message received ---", payload); // 1. See the raw data

      const msg = payload.new;
      const eventType = payload.eventType;

      // 2. Log the variables we are about to check
      console.log(`My user ID: ${userId}`);
      console.log(`Current chat partner (receiverId): ${receiverId}`);
      console.log(`Message Details: sender=${msg.sender_id}, receiver=${msg.receiver_id}`);

      const isInCurrentChat = (
        receiverId &&
        ((msg.sender_id === userId && msg.receiver_id === receiverId) ||
         (msg.sender_id === receiverId && msg.receiver_id === userId))
      );

      // 3. Log the result of our check
      console.log(`Is this message for the current chat? ${isInCurrentChat}`);

      if (eventType === 'INSERT' && isInCurrentChat) {
        console.log("✅ Logic passed! Rendering message now."); // 4. This is what we want to see
        renderMessageRow(msg);
        if (msg.receiver_id === userId) {
          markRead(msg.sender_id);
        }
      } else if (eventType === 'UPDATE' && isInCurrentChat) {
        console.log("✅ Logic passed! Updating message ticks now.");
        renderMessageRow(msg);
      } else {
        console.log("❌ Logic failed. Ignoring this message for the UI.");
      }
      console.log("------------------------------------");
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Realtime channel subscribed!');
    }
  });


  // MODERATION FUNCTION LANGUAGE
  // In static/js/chat.js, inside the (function () { ... })();

  // ... (keep all your existing code up to the event listeners)

  // --- NEW CONTENT MODERATION FRAMEWORK ---

  const moderationWarning = document.getElementById('moderation-warning');
  let warningCount = 0;
  let debounceTimer;





// In static/js/chat.js
//new update code
async function checkTextRealtime() {
    const text = messageInput.value;
    if (text.trim().length < 5) { return; } // Don't check short text

    try {
        const res = await fetch('/api/moderate-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text }),
        });
        const data = await res.json();

        if (data.is_harmful) {
            
            // --- THIS IS THE CRITICAL LINE ---
            // It checks for data.reason, or uses a default if it's missing
            const warningText = data.reason || "Please use respectful language.";
            // --- END CRITICAL LINE ---
            
            Swal.fire({
                icon: 'warning',
                title: 'Content Warning',
                text: warningText, // Use the specific reason
                toast: true,
                position: 'top',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            });

            messageForm.querySelector('button').disabled = true;
            warningCount++;
            console.log(`Warning count: ${warningCount}`);

            if (warningCount >= 3) {
                lockoutUser();
            }

        } else {
            // Text is OK
            if (receiverId) {
                messageForm.querySelector('button').disabled = false;
            }
            warningCount = 0;
        }
    } catch (e) {
        console.error("Moderation check failed:", e);
    }
}

// This function triggers the logout and temporary ban
async function lockoutUser() {
    warningCount = 0; // Reset count
    // Show a final, more serious modal before logging out
    Swal.fire({
        icon: 'error',
        title: 'Account Locked',
        text: 'You have received multiple warnings for harmful language. You will be logged out for 5 minutes.',
        allowOutsideClick: false, // User cannot dismiss by clicking outside
    }).then(async () => {
        // This code runs after the user clicks "OK"
        await fetch('/api/set-lockout');
        window.location.href = '/logout';
    });
}




  // Debounce function to prevent API calls on every keystroke
  function debounce(func, delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(func, delay);
  }

  // Attach the listener to the message input field
  if (messageInput) {
    messageInput.addEventListener('keyup', () => {
      // We wait 500ms after the user stops typing before checking
      debounce(checkTextRealtime, 500);
    });
  }



  // --- Event Listeners ---
  if (usersUl) {
    usersUl.addEventListener("click", function (ev) {
      const li = ev.target.closest(".user-item");
      if (!li) return;

      // Remove active class from previous user
      const activeLi = usersUl.querySelector('.user-item.active');
      if (activeLi) activeLi.classList.remove('active');
      
      // Add active class to current user
      li.classList.add('active');

      receiverId = li.dataset.userId;
      receiverName = li.dataset.userName;
      chatTitle.textContent = `Chat with ${receiverName}`;
      messageInput.disabled = false;
      messageForm.querySelector('button').disabled = false;
      loadMessages();
    });
  }

  if (messageForm) {
    messageInput.disabled = true;
    messageForm.querySelector('button').disabled = true;
    messageForm.addEventListener("submit", sendMessage);
  }
})();