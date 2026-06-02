"use client";

import { useState } from "react";
import { X, Github, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface LoginModalProps {
  onClose: () => void;
}

type Mode = "signin" | "signup";

export function LoginModal({ onClose }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : "/auth/callback";

  const handleOAuth = async (provider: "github" | "google") => {
    setLoading(provider);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      toast.error("OAuth failed", { description: error.message });
      setLoading(null);
    }
    // On success the page redirects — modal stays loading until redirect
  };

  const handleEmail = async () => {
    if (!email || !password) return;
    setLoading("email");
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name || email.split("@")[0] } },
      });
      if (error) {
        toast.error("Sign up failed", { description: error.message });
      } else {
        toast.success("Check your email", {
          description: "We sent a confirmation link to " + email,
        });
        onClose();
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Sign in failed", { description: error.message });
      } else {
        toast.success("Signed in");
        onClose();
      }
    }
    setLoading(null);
  };

  return (
    <div className="lm-scrim" onClick={onClose}>
      <div className="lm-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lm-header">
          <div>
            <h2 className="lm-title">
              {mode === "signin" ? "Sign in to VibeKit" : "Create an account"}
            </h2>
            <p className="lm-sub">
              {mode === "signin"
                ? "Save your preferences and access your work from any device."
                : "Set up your account to sync preferences across devices."}
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className="lm-body">
          {/* OAuth buttons */}
          <div className="lm-oauth-row">
            <button
              className="lm-oauth-btn"
              onClick={() => handleOAuth("github")}
              disabled={!!loading}
              type="button"
            >
              {loading === "github"
                ? <Loader2 size={16} className="animate-spin" />
                : <Github size={16} />}
              GitHub
            </button>
            <button
              className="lm-oauth-btn"
              onClick={() => handleOAuth("google")}
              disabled={!!loading}
              type="button"
            >
              {loading === "google"
                ? <Loader2 size={16} className="animate-spin" />
                : <GoogleIcon />}
              Google
            </button>
          </div>

          <div className="lm-divider"><span>or continue with email</span></div>

          {/* Email form */}
          <div className="lm-form">
            {mode === "signup" && (
              <div className="lm-field">
                <label className="lm-label" htmlFor="lm-name">Display name</label>
                <input
                  id="lm-name"
                  className="lm-input"
                  placeholder="Jordan Kessler"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="lm-field">
              <label className="lm-label" htmlFor="lm-email">Email</label>
              <div className="lm-input-wrap">
                <Mail size={14} className="lm-input-icon" />
                <input
                  id="lm-email"
                  className="lm-input lm-input-icon-pl"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  autoFocus={mode === "signin"}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                />
              </div>
            </div>

            <div className="lm-field">
              <label className="lm-label" htmlFor="lm-pass">Password</label>
              <div className="lm-input-wrap">
                <input
                  id="lm-pass"
                  className="lm-input lm-input-pass-pr"
                  type={showPass ? "text" : "password"}
                  placeholder={mode === "signup" ? "Min. 6 characters" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  onKeyDown={(e) => e.key === "Enter" && handleEmail()}
                />
                <button
                  className="lm-show-pass"
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass((s) => !s)}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary lm-submit"
              onClick={handleEmail}
              disabled={!email || !password || !!loading}
              type="button"
            >
              {loading === "email"
                ? <><Loader2 size={15} className="animate-spin" /> {mode === "signin" ? "Signing in…" : "Creating account…"}</>
                : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </div>
        </div>

        {/* Footer toggle */}
        <div className="lm-footer">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button className="lm-toggle" onClick={() => setMode("signup")} type="button">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="lm-toggle" onClick={() => setMode("signin")} type="button">
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
