# Outbound Email Worker for Cloudflare

This Cloudflare Worker sends outbound emails using the SMTP2Go API and stores copies in R2 storage.

## Features

- Sends emails using SMTP2Go
- Handles reply chains with proper In-Reply-To and References headers
- Stores sent emails in R2 storage
- Integrates with the email processor worker to record sent emails in the database

## API

### Send Email

```
POST /
Content-Type: application/json

{
  "to": "recipient@example.com", // Required: string or array of strings
  "cc": ["cc1@example.com", "cc2@example.com"], // Optional: array of strings
  "bcc": ["bcc@example.com"], // Optional: array of strings
  "subject": "Email Subject", // Required: string
  "body": "<p>HTML body content</p>", // Required: string (HTML format)
  "replyTo": "reply@example.com", // Optional: string
  "inReplyToMessageId": "<message-id@example.com>" // Optional: string
}
```

#### Response

```json
{
  "success": true,
  "smtp2goResult": { ... },  // Response from SMTP2Go API
  "emailPath": "emails/sender@example.com/Sent/1234567890_abcdef.eml"
}
```

## Configuration

### Environment Variables

- `DEFAULT_FROM_ADDRESS`: The default sender email address
- `SMTP2GO_API_KEY`: Your SMTP2Go API key (set as a secret)

### Service Bindings

- `EMAIL_PROCESSOR`: Binding to the email processor worker that updates the database

### R2 Bucket

- `EMAIL_BUCKET`: R2 bucket for storing email files

## Setup Instructions

1. **Prerequisites**:
   - [Node.js](https://nodejs.org/) (v16 or later)
   - [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
   - A Cloudflare account with Workers and R2 enabled
   - An SMTP2Go account with API access

2. **Configuration**:
   - Edit `wrangler.toml` to update your account ID and other settings
   - Set up your SMTP2Go API key as a secret:
     ```
     wrangler secret put SMTP2GO_API_KEY
     ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Development**:
   ```bash
   npm run dev
   ```

5. **Deployment**:
   ```bash
   npm run deploy
   ```

## Email Storage Structure

Sent emails are stored in R2 with the following path structure:
```
emails/{sender-email}/Sent/{timestamp}_{random-id}.eml
```

## Integration with Other Workers

This worker is part of a system that includes:
- `enough-inbound-emails`: Receives incoming emails
- `email-processor-worker`: Processes emails and stores metadata in a database
- `enough-inbox-ui`: Web UI for viewing and responding to emails

## Best Practices

- Keep your SMTP2Go API key secure
- Monitor API usage to stay within SMTP2Go limits
- Set up proper SPF, DKIM, and DMARC records for your sending domains
- Implement rate limiting for production use