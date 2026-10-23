import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Download, KeyRound, Pencil, Settings as SettingsIcon, Trash2, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { ApiError, api, getToken } from "../lib/api";
import { keys, useAppSettings, useCategories } from "../lib/queries";
import { ErrorAlert, Skeleton } from "../components/states";
import { Card, CardHeader } from "../components/ui/primitives";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";

export function Settings() {
  const qc = useQueryClient();
  const categories = useCategories();
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Change-password form (used only when backend exposes the endpoint)
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwPending, setPwPending] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Profile display name (shown in the top-right header)
  const settings = useAppSettings();
  const [displayName, setDisplayName] = useState("");
  const [namePending, setNamePending] = useState(false);
  useEffect(() => {
    if (settings.data) setDisplayName(settings.data.display_name);
  }, [settings.data]);

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length > 40) {
      toast.error("Name must be 1–40 characters");
      return;
    }
    setNamePending(true);
    try {
      await api.updateSettings({ display_name: trimmed });
      await qc.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not save name");
    } finally {
      setNamePending(false);
    }
  }

  useEffect(() => {
    if (renaming) setRenameValue(renaming.name);
  }, [renaming]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await api.deleteCategory(deleting.id);
      toast.success(`Category deleted: ${deleting.name}`);
      void qc.invalidateQueries({ queryKey: keys.categories() });
      setDeleting(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(`"${deleting.name}" is in use by commitments or transactions`);
      } else {
        toast.error(err instanceof ApiError ? err.detail : "Could not delete category");
      }
    } finally {
      setDeletePending(false);
      setDeleting(null);
    }
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming || !renameValue.trim()) return;
    try {
      await api.updateCategory(renaming.id, { name: renameValue.trim() });
      toast.success("Category renamed");
      void qc.invalidateQueries({ queryKey: keys.categories() });
      setRenaming(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not rename category");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwPending || !oldPw || !newPw) return;
    setPwPending(true);
    setPwError(null);
    try {
      await api.changePassword(oldPw, newPw);
      toast.success("Password changed");
      setOldPw("");
      setNewPw("");
    } catch (err) {
      setPwError(err instanceof ApiError ? err.detail : "Could not change password");
    } finally {
      setPwPending(false);
    }
  }

  function downloadExport() {
    void (async () => {
      try {
        const data = await api.export();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `commitment-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Export downloaded");
      } catch {
        toast.error("Could not export data");
      }
    })();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {/* Profile */}
      <Card>
        <CardHeader icon={<UserRound className="h-6 w-6" />} title="Profile" subtitle="Shown in the top-right corner of the app." />
        <form onSubmit={saveDisplayName} className="flex max-w-sm items-end gap-2">
          <div className="flex-1">
            <input
              aria-label="Display name"
              className="w-full rounded-xl border border-base-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blush-400 focus:ring-2 focus:ring-blush-200 dark:bg-base-300"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="Your name"
            />
          </div>
          <Button type="submit" size="sm" disabled={namePending || !displayName.trim()} className="bg-blush-500 text-white hover:bg-blush-600">
            {namePending ? <span className="loading loading-spinner loading-xs" /> : <Check className="h-4 w-4" />}
            Save
          </Button>
        </form>
      </Card>

      {/* Auth status */}
      <Card>
        <CardHeader icon={<KeyRound className="h-6 w-6" />} title="Authentication" />
        <p className="text-sm text-mauve">
          {getToken() ? "Signed in with an access token." : "No token stored — authentication is disabled on the backend."}
        </p>
        <form onSubmit={changePassword} className="mt-4 flex max-w-sm flex-col gap-3">
          <span className="text-sm font-medium text-ink">Change app password</span>
          <input
            type="password" placeholder="Current password" className="w-full rounded-xl border border-base-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blush-400 focus:ring-2 focus:ring-blush-200 dark:bg-base-300"
            value={oldPw} onChange={(e) => setOldPw(e.target.value)}
          />
          <input
            type="password" placeholder="New password" className="w-full rounded-xl border border-base-300 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blush-400 focus:ring-2 focus:ring-blush-200 dark:bg-base-300"
            value={newPw} onChange={(e) => setNewPw(e.target.value)}
          />
          {pwError && <div className="text-sm text-error">{pwError}</div>}
          <Button type="submit" size="sm" disabled={pwPending || !oldPw || !newPw} className="self-start bg-blush-500 text-white hover:bg-blush-600">
            {pwPending && <span className="loading loading-spinner loading-xs" />}
            Change password
          </Button>
          <p className="text-xs text-mauve/80">
            If the backend was started without APP_PASSWORD this endpoint may not exist and the change will fail.
          </p>
        </form>
      </Card>

      {/* Data export */}
      <Card>
        <CardHeader icon={<Download className="h-6 w-6" />} title="Data export" subtitle="Download all your data as a JSON file." />
        <Button variant="outline" size="sm" onClick={downloadExport}>
          <Download className="h-4 w-4" /> Export JSON
        </Button>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader icon={<SettingsIcon className="h-6 w-6" />} title="Categories" />
        {categories.isLoading ? (
          <Skeleton className="h-32" />
        ) : categories.isError ? (
          <ErrorAlert message="Could not load categories." onRetry={() => void categories.refetch()} />
        ) : (
          <ul className="flex flex-col divide-y divide-blush-100/80 dark:divide-base-300">
            {(categories.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className="flex-1 text-sm font-medium text-ink">{c.name}</span>
                {c.is_default && <span className="rounded-md bg-blush-100 px-2 py-0.5 text-xs text-blush-700">default</span>}
                <Button variant="ghost" size="icon-sm" aria-label={`Rename ${c.name}`} onClick={() => setRenaming({ id: c.id, name: c.name })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.name}`} className="text-error" onClick={() => setDeleting({ id: c.id, name: c.name })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Rename dialog */}
      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
            <DialogDescription>This updates the name everywhere it is used.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRename} className="flex flex-col gap-4">
            <input
              className="input input-bordered w-full rounded-btn bg-base-100 border-base-300 focus:border-primary"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
              <Button type="submit" disabled={!renameValue.trim()}>Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `"${deleting.name}" will be removed. Categories in use by commitments or transactions cannot be deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deletePending} onClick={(e) => { e.preventDefault(); void confirmDelete(); }}>
              {deletePending && <span className="loading loading-spinner loading-sm" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
