// /static/messaging.js

/**
 * Initializes the messaging module, adding event listeners for sending messages.
 * This function is called when the 'Send Message' tab is first activated.
 * @param {object} deps - An object containing dependencies like API_URL, currentUser, and showToast.
 */
function initializeMessagingModule(deps) {
    const { API_URL, currentUser, showToast } = deps;

    // --- DOM ELEMENTS ---
    const messageForm = document.getElementById('message-form');
    const messageRecipientInput = document.getElementById('message-recipient');
    const messageContentInput = document.getElementById('message-content');
    const messageSendButton = messageForm.querySelector('button[type="submit"]');

    // --- EVENT LISTENER for form submission ---
    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission which causes page reload

            const recipientEmail = messageRecipientInput.value.trim();
            const messageContent = messageContentInput.value.trim();

            if (!recipientEmail || !messageContent) {
                showToast('Recipient and message cannot be empty.', true);
                return;
            }

            // Disable button and show loading state
            messageSendButton.disabled = true;
            messageSendButton.innerHTML = `<div class="loader !w-5 !h-5 !border-2"></div><span class="ml-2">Sending...</span>`;

            const payload = {
                sender: currentUser.email,
                recipient: recipientEmail,
                message: messageContent
            };

            try {
                const response = await fetch(`${API_URL}/send_message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                // Show toast notification based on the API response
                showToast(result.message, !result.success);

                if (result.success) {
                    // Clear the form fields on successful submission
                    messageForm.reset();
                }

            } catch (error) {
                console.error('Failed to send message:', error);
                showToast('An error occurred while sending the message.', true);
            } finally {
                // Re-enable the button and restore its original text
                messageSendButton.disabled = false;
                messageSendButton.textContent = 'Send Message';
            }
        });
    }
}
