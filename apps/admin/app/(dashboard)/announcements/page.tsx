"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { convexApi } from "@betterdata/app-api";
import { useAdminAuth } from "../../lib/auth";
import { DataTable, type ColumnDef } from "../../components/DataTable";
import { useToast } from "../../components/Toast";

type Announcement = {
  _id: string;
  title: string;
  body: string;
  audience: "all" | "users" | "agents";
  sentAt?: number;
};

type DeliveryChannel = "in-app" | "email" | "both";

export default function AnnouncementsPage() {
  const { getAuthHeaders } = useAdminAuth();
  const { showToast } = useToast();

  // Form State
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all" | "users" | "agents">("all");
  const [channel, setChannel] = useState<DeliveryChannel>("both");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Table State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);

  // Queries & Mutations
  const announcements = useQuery(convexApi.admin.listAnnouncements);
  const createAnnouncement = useMutation(convexApi.admin.createAnnouncement);
  const deleteAnnouncement = useMutation(convexApi.admin.deleteAnnouncement);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !body.trim()) {
      setFormSuccess(null);
      setFormError("Title and body are required fields.");
      showToast("Title and body are required fields.", "warning");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      // 1. Create the announcement record in Convex (necessary for email broadcast to load it)
      const id = await createAnnouncement({
        title,
        body,
        audience,
      });

      let emailStatusMessage = "";

      // 2. Trigger email broadcast if requested
      if (channel === "email" || channel === "both") {
        const headers = await getAuthHeaders();
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

        const res = await fetch(
          `${apiBaseUrl}/admin/announcements/${id}/broadcast`,
          {
            method: "POST",
            headers,
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.message || "Failed to broadcast email campaign.",
          );
        }

        const data = await res.json();
        emailStatusMessage = ` Broadcast sent to ${data.audienceSize} recipients.`;
      }

      // If Email Only was requested, delete the database record so it is not visible in-app.
      // We still kept it temporarily to let the API endpoint fetch it using serviceSecret.
      if (channel === "email") {
        await deleteAnnouncement({ announcementId: id as any });
      }

      const successMessage = `Announcement published successfully!${emailStatusMessage}`;
      setFormSuccess(successMessage);
      showToast(successMessage, "success");
      setTitle("");
      setBody("");
      setAudience("all");
      setChannel("both");
    } catch (err: any) {
      console.error("Announcement submission failed:", err);
      const errorMessage = err.message || "Something went wrong.";
      setFormError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBroadcast = async (announcement: Announcement) => {
    if (
      !confirm(
        `Are you sure you want to broadcast "${announcement.title}" via email to audience: ${announcement.audience}?`,
      )
    ) {
      return;
    }

    setBroadcastingId(announcement._id);
    try {
      const headers = await getAuthHeaders();
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

      const res = await fetch(
        `${apiBaseUrl}/admin/announcements/${announcement._id}/broadcast`,
        {
          method: "POST",
          headers,
        },
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to broadcast email.");
      }

      const data = await res.json();
      showToast(
        `Broadcast sent! ${data.successCount} succeeded, ${data.failureCount} failed.`,
        "success",
      );
    } catch (err: any) {
      showToast(err.message || "Failed to send email broadcast.", "error");
    } finally {
      setBroadcastingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this announcement? It will no longer be visible to users in-app.",
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteAnnouncement({ announcementId: id as any });
      showToast("Announcement deleted.", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to delete announcement.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const columns: ColumnDef<Announcement>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--text)" }}>
            {row.title}
          </div>
          <div
            className="text-xs text-muted"
            style={{
              maxWidth: "300px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.body}
          </div>
        </div>
      ),
    },
    {
      key: "audience",
      header: "Audience",
      render: (row) => (
        <span className={`badge badge-info`}>
          {row.audience === "all"
            ? "All Users & Agents"
            : row.audience === "users"
              ? "Users Only"
              : "Agents Only"}
        </span>
      ),
    },
    {
      key: "sentAt",
      header: "Date Sent",
      hiddenOnMobile: true,
      render: (row) => (
        <span className="text-muted text-sm">
          {row.sentAt ? new Date(row.sentAt).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button
            onClick={() => handleBroadcast(row)}
            disabled={broadcastingId === row._id}
            className="btn btn-secondary btn-sm"
          >
            {broadcastingId === row._id ? "Sending..." : "Email Broadcast"}
          </button>
          <button
            onClick={() => handleDelete(row._id)}
            disabled={deletingId === row._id}
            className="btn btn-ghost btn-sm text-danger"
            style={{ color: "var(--danger)" }}
          >
            {deletingId === row._id ? "Deleting..." : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: "var(--space-6)" }}>
        <div>
          <h1 className="page-title">Announcements & Broadcasts</h1>
          <p className="page-subtitle">
            Publish system notifications and trigger email blasts to users or
            agents
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "var(--space-6)",
          alignItems: "start",
        }}
      >
        {/* Compose Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-header-title">Compose Announcement</h3>
          </div>
          <form
            onSubmit={handleSubmit}
            className="card-body"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            {formError && (
              <div
                style={{
                  padding: "var(--space-3)",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid var(--danger)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--danger)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {formError}
              </div>
            )}
            {formSuccess && (
              <div
                style={{
                  padding: "var(--space-3)",
                  backgroundColor: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid var(--success)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--success)",
                  fontSize: "var(--font-size-sm)",
                }}
              >
                {formSuccess}
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="title">
                Title / Subject
              </label>
              <input
                id="title"
                type="text"
                className="input"
                placeholder="System maintenance, new packages, etc."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid-responsive-1-1" style={{ gap: "var(--space-4)" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="audience">
                  Audience Group
                </label>
                <select
                  id="audience"
                  className="select"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  disabled={isSubmitting}
                >
                  <option value="all">All Users & Agents</option>
                  <option value="users">Regular Users</option>
                  <option value="agents">Agents Only</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="channel">
                  Delivery Channel
                </label>
                <select
                  id="channel"
                  className="select"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  disabled={isSubmitting}
                >
                  <option value="both">Both (In-App & Email)</option>
                  <option value="in-app">In-App Notification Only</option>
                  <option value="email">Email Broadcast Only</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="body">
                Message Body
              </label>
              <textarea
                id="body"
                className="textarea"
                rows={6}
                placeholder="Type your message here. For email, HTML styling is supported."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={isSubmitting}
                style={{ resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ marginTop: "var(--space-2)" }}
            >
              {isSubmitting ? "Sending Announcement..." : "Send Announcement"}
            </button>
          </form>
        </div>

        {/* History / List */}
        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <div className="card-header">
            <h3 className="card-header-title">Announcement History</h3>
          </div>
          <div className="card-body" style={{ flex: 1 }}>
            <DataTable
              columns={columns}
              data={announcements ?? []}
              isLoading={announcements === undefined}
              emptyStateTitle="No announcements found"
              emptyStateDescription="Created announcements will be shown here."
              rowKey={(row) => row._id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
