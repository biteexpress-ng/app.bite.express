"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, User2 } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { uploadAvatar, fetchProfile } from "@/lib/api/auth";
import { cn } from "@/lib/cn";

const MAX_BYTES = 2 * 1024 * 1024; // backend rule: 2048 KB
const ACCEPTED = "image/png,image/jpeg,image/webp";

/**
 * Avatar upload card for /profile/edit.
 *
 * - Click the avatar (or "Change photo") to pick a file.
 * - Client-side checks: type ∈ {png,jpg,webp}, size ≤ 2 MB.
 * - On success refetches /customer/info so the header avatar
 *   updates immediately without a page reload.
 *
 * No crop UX in v0 — uploads the original. The backend resizes.
 */
export function AvatarUploader() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // preview blob URL

  async function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setError(null);

    if (!ACCEPTED.split(",").includes(file.type)) {
      setError("Use a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Pick an image under 2 MB.");
      return;
    }

    // Optimistic preview
    const previewUrl = URL.createObjectURL(file);
    setPending(previewUrl);
    setUploading(true);

    const res = await uploadAvatar(file, user);
    if (res.ok) {
      const fresh = await fetchProfile();
      if (fresh.ok) setUser(fresh.user);
      // Keep the preview around until next render flips it to the
      // server-resolved URL; revoke the blob to free memory.
      setTimeout(() => {
        URL.revokeObjectURL(previewUrl);
        setPending(null);
      }, 1000);
    } else {
      URL.revokeObjectURL(previewUrl);
      setPending(null);
      setError(res.message);
    }
    setUploading(false);

    // Reset the input so re-picking the same file re-fires onChange.
    if (inputRef.current) inputRef.current.value = "";
  }

  const avatar = pending ?? user?.image_full_url ?? null;

  return (
    <div className="flex items-center gap-5 rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change profile photo"
        className={cn(
          "relative inline-flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-100 text-ink-500 transition-colors hover:bg-ink-200",
          uploading && "cursor-wait opacity-70",
        )}
      >
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
            unoptimized={pending !== null /* blob: URL */}
          />
        ) : (
          <User2 size={28} strokeWidth={1.8} />
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <Loader2 size={20} className="animate-spin" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">Profile photo</p>
        <p className="mt-0.5 text-xs text-ink-500">
          PNG, JPG or WebP. Max 2 MB.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-900 hover:bg-ink-50",
            uploading && "cursor-wait opacity-70",
          )}
        >
          <Camera size={12} />
          {uploading ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}
        </button>
        {error && (
          <p className="mt-2 text-xs text-error">{error}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={handlePicked}
      />
    </div>
  );
}
