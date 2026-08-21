"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  MAX_PROFILES,
  profileAccents,
  type LocalProfile,
  type ProfileAccent,
} from "../lib/profiles";

type ProfileActions = {
  profiles: LocalProfile[];
  activeProfileId: string;
  onSwitch: (profileId: string) => void;
  onCreate: (name: string) => boolean;
  onRename: (profileId: string, name: string) => void;
  onAccent: (profileId: string, accent: ProfileAccent) => void;
  onDelete: (profileId: string) => void;
};

function profileInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function ProfileSettings(props: ProfileActions) {
  const active = props.profiles.find((profile) => profile.id === props.activeProfileId)
    ?? props.profiles[0];
  const [name, setName] = useState(active?.name ?? "");
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");

  function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (!active || !cleanName) return;
    props.onRename(active.id, cleanName);
    setMessage("Profilname gespeichert.");
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = newName.trim().replace(/\s+/g, " ");
    if (!cleanName) return;
    if (!props.onCreate(cleanName)) {
      setMessage(props.profiles.length >= MAX_PROFILES
        ? `Maximal ${MAX_PROFILES} Profile sind möglich.`
        : "Dieser Profilname ist bereits vergeben.");
      return;
    }
    setNewName("");
    setMessage(`${cleanName} ist jetzt aktiv.`);
  }

  if (!active) return null;

  return (
    <section className="settings-card profile-settings-card" aria-labelledby="profile-title">
      <div className="settings-heading">
        <div><span className="eyebrow">DEIN BEREICH</span><h2 id="profile-title">Profile</h2></div>
        <span className={`profile-avatar accent-${active.accent}`}>{profileInitials(active.name)}</span>
      </div>
      <p className="settings-intro">Jedes Profil hat ein eigenes Portfolio, eigene Zahlungen und eigene Einstellungen – vollständig lokal.</p>

      <form className="profile-name-form" onSubmit={rename}>
        <label className="field">Aktiver Profilname
          <span className="profile-input-action">
            <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} required />
            <button className="button ghost" type="submit">Speichern</button>
          </span>
        </label>
      </form>

      <div className="field profile-color-field">
        <span>Profilfarbe</span>
        <div className="profile-colors" aria-label="Profilfarbe auswählen">
          {profileAccents.map((accent) => (
            <button
              key={accent}
              type="button"
              className={`accent-${accent} ${active.accent === accent ? "active" : ""}`}
              aria-label={`Profilfarbe ${accent}`}
              aria-pressed={active.accent === accent}
              onClick={() => props.onAccent(active.id, accent)}
            />
          ))}
        </div>
      </div>

      <div className="profile-list" aria-label="Vorhandene Profile">
        {props.profiles.map((profile) => {
          const isActive = profile.id === props.activeProfileId;
          return (
            <div className={isActive ? "active" : ""} key={profile.id}>
              <button type="button" className="profile-select" onClick={() => props.onSwitch(profile.id)} aria-pressed={isActive}>
                <span className={`profile-avatar small accent-${profile.accent}`}>{profileInitials(profile.name)}</span>
                <span><strong>{profile.name}</strong><small>{isActive ? "Aktiv" : "Wechseln"}</small></span>
              </button>
              <button
                type="button"
                className="profile-delete"
                disabled={props.profiles.length <= 1}
                aria-label={`Profil ${profile.name} löschen`}
                onClick={() => props.onDelete(profile.id)}
              >×</button>
            </div>
          );
        })}
      </div>

      <form className="profile-add-form" onSubmit={add}>
        <label className="field">Weiteres Profil
          <span className="profile-input-action">
            <input
              value={newName}
              maxLength={40}
              placeholder="Name oder Spitzname"
              onChange={(event) => { setNewName(event.target.value); setMessage(""); }}
            />
            <button className="button dark" type="submit" disabled={!newName.trim() || props.profiles.length >= MAX_PROFILES}>Hinzufügen</button>
          </span>
        </label>
      </form>
      <p className="profile-message" aria-live="polite">{message || `${props.profiles.length} von ${MAX_PROFILES} Profilen angelegt.`}</p>
    </section>
  );
}

export function ProfilePicker({
  profiles,
  open,
  onClose,
  onSwitch,
}: {
  profiles: LocalProfile[];
  open: boolean;
  onClose: () => void;
  onSwitch: (profileId: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="profile-picker-backdrop" role="dialog" aria-modal="true" aria-labelledby="profile-picker-title">
      <section className="profile-picker-card">
        <div className="modal-head"><div><span className="eyebrow">WILLKOMMEN</span><h2 id="profile-picker-title">Wer nutzt Dividendenfluss?</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Schließen">×</button></div>
        <p>Wähle dein Profil. Portfolios, Zahlungen und Einstellungen bleiben voneinander getrennt.</p>
        <div className="profile-picker-list">
          {profiles.map((profile) => (
            <button key={profile.id} type="button" onClick={() => { onSwitch(profile.id); onClose(); }}>
              <span className={`profile-avatar accent-${profile.accent}`}>{profileInitials(profile.name)}</span>
              <strong>{profile.name}</strong><i>→</i>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
