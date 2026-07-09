const nodemailer = require("nodemailer");
const { Resend } = require("resend");

// ---------------------------------------------------------------------------
// Transporter setup
// Priority: Resend API (recommended for cloud hosting) → fallback to SMTP
// ---------------------------------------------------------------------------
let transporter;

if (process.env.RESEND_API_KEY) {
    // Resend nodemailer transport — works on Render/Railway free tier with no
    // port restrictions. Sign up at https://resend.com (free: 3k emails/month)
    const resend = new Resend(process.env.RESEND_API_KEY);
    transporter = nodemailer.createTransport(resend.nodemailerTransport());
} else {
    // Fallback: raw SMTP (works locally with Gmail App Password)
    const smtpPort = parseInt(process.env.SMTP_PORT, 10) || 465;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
    });
    console.warn("[Mailer] RESEND_API_KEY not set — falling back to raw SMTP (may fail on cloud hosts).");
}

// 1. Send status update notification email
const sendStatusUpdateEmail = async (toEmail, customerName, requestDetails) => {
    try {
        if (!toEmail) return { success: true, message: "No email provided" };

        const mailOptions = {
            from: `RTO Ledger System <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Update on your Service Request (${requestDetails.request_no})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #4f46e5;">Service Request Update</h2>
                    <p>Dear <strong>${customerName}</strong>,</p>
                    <p>This is to inform you that your service request has been updated.</p>
                    
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <ul style="list-style-type: none; padding: 0; margin: 0;">
                            <li style="margin-bottom: 10px;"><strong>Request No:</strong> ${requestDetails.request_no}</li>
                            <li style="margin-bottom: 10px;"><strong>Service:</strong> ${requestDetails.service_name || 'N/A'}</li>
                            <li style="margin-bottom: 10px;"><strong>Vehicle:</strong> ${requestDetails.vehicle_number || 'N/A'}</li>
                            <li style="margin-bottom: 10px;"><strong>Status:</strong> <span style="padding: 3px 8px; border-radius: 4px; background-color: #e0e7ff; color: #3730a3; font-weight: bold;">${requestDetails.status}</span></li>
                            <li style="margin-bottom: 10px;"><strong>Remarks:</strong> ${requestDetails.remarks || 'None'}</li>
                        </ul>
                    </div>
                    
                    <p>If you have any questions, please contact us.</p>
                    <p>Best Regards,<br><strong>RTO Ledger System Team</strong></p>
                </div>
            `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${toEmail}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`Error sending email to ${toEmail}:`, error);
        return { success: false, error: error.message };
    }
};

// 2. Send welcome email with customer code
const sendWelcomeEmail = async (toEmail, customerName, customerCode) => {
    try {
        if (!toEmail) return;
        const mailOptions = {
            from: `RTO Ledger System <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Welcome to RTO Ledger System!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #4f46e5;">Welcome, ${customerName}!</h2>
                    <p>Thank you for registering with the RTO Ledger System.</p>
                    <p>Your unique Customer Code is: <strong>${customerCode}</strong></p>
                    <p>You can use this code or your mobile number to log in to the Customer Portal and track your requests.</p>
                    <p>Best Regards,<br><strong>RTO Ledger System Team</strong></p>
                </div>
            `,
        };
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`Error sending welcome email to ${toEmail}:`, error);
    }
};

// 3. Send account activation email
const sendActivationEmail = async (toEmail, customerName) => {
    try {
        if (!toEmail) return;
        const mailOptions = {
            from: `RTO Ledger System <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Account Activated Successfully`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #10b981;">Account Activated!</h2>
                    <p>Dear <strong>${customerName}</strong>,</p>
                    <p>Your account password has been successfully set, and your account is now active.</p>
                    <p>Best Regards,<br><strong>RTO Ledger System Team</strong></p>
                </div>
            `,
        };
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`Error sending activation email to ${toEmail}:`, error);
    }
};

// 4. Send request raised confirmation email
const sendRequestCreatedEmail = async (toEmail, customerName, requestDetails) => {
    try {
        if (!toEmail) return;
        const mailOptions = {
            from: `RTO Ledger System <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `New Service Request Created (${requestDetails.request_no})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #3b82f6;">Service Request Created</h2>
                    <p>Dear <strong>${customerName}</strong>,</p>
                    <p>A new service request has been successfully created in your account.</p>
                    
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <ul style="list-style-type: none; padding: 0; margin: 0;">
                            <li style="margin-bottom: 10px;"><strong>Request No:</strong> ${requestDetails.request_no}</li>
                            <li style="margin-bottom: 10px;"><strong>Service:</strong> ${requestDetails.service_name || 'N/A'}</li>
                            <li style="margin-bottom: 10px;"><strong>Vehicle:</strong> ${requestDetails.vehicle_number || 'N/A'}</li>
                            <li style="margin-bottom: 10px;"><strong>Status:</strong> <span style="padding: 3px 8px; border-radius: 4px; background-color: #fef3c7; color: #92400e; font-weight: bold;">${requestDetails.status}</span></li>
                        </ul>
                    </div>
                    
                    <p>Best Regards,<br><strong>RTO Ledger System Team</strong></p>
                </div>
            `,
        };
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`Error sending request created email:`, error);
    }
};

// 5. Send transaction receipt email
const sendReceiptEmail = async (toEmail, customerName, receiptDetails) => {
    try {
        if (!toEmail) return;
        const mailOptions = {
            from: `RTO Ledger System <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
            to: toEmail,
            subject: `Payment Receipt (${receiptDetails.receipt_no})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #059669;">Payment Receipt</h2>
                    <p>Dear <strong>${customerName}</strong>,</p>
                    <p>Thank you for your payment. Here are your receipt details:</p>
                    
                    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #10b981;">
                        <ul style="list-style-type: none; padding: 0; margin: 0;">
                            <li style="margin-bottom: 10px;"><strong>Receipt No:</strong> ${receiptDetails.receipt_no}</li>
                            <li style="margin-bottom: 10px;"><strong>Amount Received:</strong> ₹${parseFloat(receiptDetails.amount).toFixed(2)}</li>
                            <li style="margin-bottom: 10px;"><strong>Payment Mode:</strong> ${receiptDetails.payment_mode}</li>
                            <li style="margin-bottom: 10px;"><strong>Remarks:</strong> ${receiptDetails.remarks || 'None'}</li>
                        </ul>
                    </div>
                    
                    <p>Best Regards,<br><strong>RTO Ledger System Team</strong></p>
                </div>
            `,
        };
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`Error sending receipt email:`, error);
    }
};

module.exports = {
    sendStatusUpdateEmail,
    sendWelcomeEmail,
    sendActivationEmail,
    sendRequestCreatedEmail,
    sendReceiptEmail,
};