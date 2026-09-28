"use client";

import { useId } from "react";
import type { ReactElement } from "react";
import { practitionerInitials } from "@/lib/practitioner-initials";
import type { SiteInfoPractitioner } from "@/lib/site-info";

/** The radio value of the "Any doctor" card. Never a real practitioner id: those are uuids. */
const ANY_DOCTOR_VALUE = "";

export interface DoctorPickerProps {
  /** The clinic's active doctors, in the clinic's order. The /book page only renders this picker for two or more. */
  readonly practitioners: readonly SiteInfoPractitioner[];
  /** The chosen doctor's id, or null for "Any doctor". */
  readonly selectedId: string | null;
  readonly onChange: (practitionerId: string | null) => void;
}

/**
 * The /book page's doctor choice, beside the week grid on a wide screen and above it on a narrow one: a `<fieldset>` of native radios styled as cards — "Any
 * doctor" first, then each doctor with their photo (or initials) and title. Native radios, not a custom listbox, so
 * arrow keys, Tab, and screen reader "radio 2 of 3" announcements all come from the browser for free; the visible
 * card is the radio's own <label>, and the focus ring is drawn on the card around it.
 */
export function DoctorPicker({ practitioners, selectedId, onChange }: DoctorPickerProps): ReactElement {
  const name = useId();

  return (
    <fieldset className="doctor-picker">
      <legend>Doctor</legend>
      <div className="doctor-options">
        <DoctorOption
          name={name}
          value={ANY_DOCTOR_VALUE}
          checked={selectedId === null}
          onSelect={() => onChange(null)}
          avatar={<span className="doctor-avatar doctor-avatar-any" aria-hidden="true" />}
          label="Any doctor"
          subtitle="First available"
        />
        {practitioners.map((practitioner) => (
          <DoctorOption
            key={practitioner.id}
            name={name}
            value={practitioner.id}
            checked={selectedId === practitioner.id}
            onSelect={() => onChange(practitioner.id)}
            avatar={<DoctorAvatar practitioner={practitioner} />}
            label={practitioner.name}
            subtitle={practitioner.title}
          />
        ))}
      </div>
    </fieldset>
  );
}

function DoctorOption({
  name,
  value,
  checked,
  onSelect,
  avatar,
  label,
  subtitle,
}: {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onSelect: () => void;
  readonly avatar: ReactElement;
  readonly label: string;
  readonly subtitle: string | null;
}): ReactElement {
  // The input sits inside its <label>, so a click anywhere on the card selects it and the card's text is the
  // radio's accessible name. It is visually hidden (not display:none, which would drop it from the tab order and
  // the accessibility tree); .doctor-option:has(:focus-visible) draws the focus ring on the card instead.
  return (
    <label className="doctor-option">
      <input className="sr-only" type="radio" name={name} value={value} checked={checked} onChange={onSelect} />
      {avatar}
      <span className="doctor-text">
        <span className="doctor-name">{label}</span>
        {subtitle === null ? null : (
          <span className="doctor-title" title={subtitle}>
            {subtitle}
          </span>
        )}
      </span>
    </label>
  );
}

function DoctorAvatar({ practitioner }: { readonly practitioner: SiteInfoPractitioner }): ReactElement {
  if (practitioner.photoUrl !== null) {
    // A plain <img>, the same as components/post-card.tsx: the photo lives on the Firstfold platform, whose host
    // isn't (and shouldn't need to be) listed in next.config's images.remotePatterns. alt="" because the doctor's
    // name sits right beside it — the photo adds nothing a screen reader user is missing.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="doctor-avatar" src={practitioner.photoUrl} alt="" width={44} height={44} loading="lazy" />
    );
  }
  return (
    <span className="doctor-avatar doctor-avatar-initials" aria-hidden="true">
      {practitionerInitials(practitioner.name)}
    </span>
  );
}
