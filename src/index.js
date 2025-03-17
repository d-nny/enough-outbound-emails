export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const { to, cc, bcc, subject, body, replyTo, inReplyToMessageId } = await request.json();
      
      if (!to || !subject || !body) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const smtp2goPayload = {
        api_key: env.SMTP2GO_API_KEY,
        to: Array.isArray(to) ? to : [to],
        sender: env.DEFAULT_FROM_ADDRESS || "noreply@taskblob.com",
        subject,
        html_body: body,
        text_body: body.replace(/<[^>]*>/g, ''),
      };
      
      // Add optional parameters if provided
      if (cc && cc.length > 0) smtp2goPayload.cc = Array.isArray(cc) ? cc : [cc];
      if (bcc && bcc.length > 0) smtp2goPayload.bcc = Array.isArray(bcc) ? bcc : [bcc];
      if (replyTo) smtp2goPayload.custom_headers = [{ "Reply-To": replyTo }];
      if (inReplyToMessageId) {
        if (!smtp2goPayload.custom_headers) smtp2goPayload.custom_headers = [];
        smtp2goPayload.custom_headers.push({ "In-Reply-To": inReplyToMessageId });
        smtp2goPayload.custom_headers.push({ "References": inReplyToMessageId });
      }

      // Send the email via SMTP2Go API
      const smtp2goResponse = await fetch("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtp2goPayload)
      });

      const smtp2goResult = await smtp2goResponse.json();
      
      if (!smtp2goResponse.ok) {
        return new Response(JSON.stringify({ 
          error: "SMTP2Go API error", 
          details: smtp2goResult 
        }), { 
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Also store the sent email in R2 for reference
      const timestamp = Math.floor(Date.now() / 1000);
      const randomId = Math.random().toString(36).substring(2, 10);
      
      // Store in Sent folder for the sender
      const emailPath = `emails/${smtp2goPayload.sender}/Sent/${timestamp}_${randomId}.eml`;
      
      // Create a basic EML file format
      const emlContent = `From: ${smtp2goPayload.sender}
To: ${smtp2goPayload.to.join(", ")}
${cc ? `Cc: ${smtp2goPayload.cc.join(", ")}\n` : ''}
${bcc ? `Bcc: ${smtp2goPayload.bcc.join(", ")}\n` : ''}
Subject: ${subject}
Date: ${new Date().toUTCString()}
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
Message-ID: <${randomId}@taskblob.com>
${inReplyToMessageId ? `In-Reply-To: ${inReplyToMessageId}\n` : ''}
${inReplyToMessageId ? `References: ${inReplyToMessageId}\n` : ''}

${body}`;

      // Store in R2
      await env.EMAIL_BUCKET.put(emailPath, emlContent, {
        customMetadata: {
          to: smtp2goPayload.to.join(", "),
          from: smtp2goPayload.sender,
          subject: subject,
          messageId: `<${randomId}@taskblob.com>`,
          size: emlContent.length,
          sentAt: new Date().toISOString(),
          unixTimestamp: timestamp
        }
      });
      
      // Call the email processor to save to database if configured
      if (env.EMAIL_PROCESSOR) {
        try {
          await env.EMAIL_PROCESSOR.fetch(new Request("/process",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ emailPath })
            }
          );
          console.log(`Sent email processed for database: ${emailPath}`);
        } catch (processorError) {
          console.error(`Failed to process sent email: ${processorError.message}`);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        smtp2goResult,
        emailPath
      }), { 
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};