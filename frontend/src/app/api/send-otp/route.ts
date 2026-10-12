import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP code are required parameters." },
        { status: 400 }
      );
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const resendKey = process.env.RESEND_API_KEY;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #060608; padding: 40px 20px; text-align: center;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #0c0c0e; border: 1px solid #1f1f23; border-radius: 16px; padding: 32px; text-align: left; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          
          <div style="display: inline-block; background-color: #10b981; color: #000000; width: 40px; height: 40px; line-height: 40px; border-radius: 10px; font-size: 20px; text-align: center; font-weight: bold; margin-bottom: 20px;">
            ❇️
          </div>
          
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin: 0 0 4px 0; tracking-tight: -0.02em;">FinSight 360</h2>
          <p style="color: #64748b; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; margin: 0 0 24px 0; font-family: monospace;">GENAI + RAG FINANCIAL COCKPIT</p>
          
          <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">Hello,</p>
          <p style="color: #e2e8f0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">To complete your authentication, please enter the following 6-digit verification code in the login portal:</p>
          
          <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 0.25em; color: #10b981; display: inline-block; padding-left: 0.25em;">${otp}</span>
          </div>
          
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0 0 24px 0;">Note: This verification code is active and will expire shortly. Do not share this code with anyone.</p>
          
          <div style="border-top: 1px solid #1f1f23; padding-top: 20px; font-size: 11px; color: #475569;">
            This email was sent dynamically from FinSight 360. If you did not make this request, please disregard this email.
          </div>
          
        </div>
      </div>
    `;

    // 1. Try Gmail SMTP if credentials are provided
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"FinSight 360" <${smtpUser}>`,
        to: email,
        subject: `${otp} is your FinSight 360 Verification Code`,
        html: emailHtml,
      });

      return NextResponse.json({ success: true, method: "smtp" });
    }

    // 2. Try Resend if configured
    if (resendKey) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: "FinSight 360 <onboarding@resend.dev>",
          to: [email],
          subject: `${otp} is your FinSight 360 Verification Code`,
          html: emailHtml,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return NextResponse.json(
          { error: data.message || "Failed to send email through Resend API." },
          { status: response.status }
        );
      }

      return NextResponse.json({ success: true, method: "resend", id: data.id });
    }

    // 3. Neither is configured
    return NextResponse.json(
      { error: "No email transporter (SMTP or Resend API) is configured in .env.local on the server." },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred on the server." },
      { status: 500 }
    );
  }
}
