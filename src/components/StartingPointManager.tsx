/**
 * Starting Point Manager component.
 *
 * Compact panel for creating, editing, and managing starting/reference points
 * used in the Distance Between Points measurement mode.
 */

import { useState } from 'react';
import type { StartingPoint } from '../types/distance';
import { generateUid } from '../utils/formatters';

interface StartingPointManagerProps {
  startingPoints: StartingPoint[];
  onAdd: (sp: StartingPoint) => void;
  onRemove: (uid: string) => void;
  onUpdate: (sp: StartingPoint) => void;
  onClose: () => void;
}

export function StartingPointManager({
  startingPoints,
  onAdd,
  onRemove,
  onUpdate,
  onClose,
}: StartingPointManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formLat, setFormLat] = useState('');
  const [formLon, setFormLon] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setFormName('');
    setFormLat('');
    setFormLon('');
    setFormDesc('');
    setFormError(null);
    setEditingUid(null);
    setShowForm(false);
  };

  const startEdit = (sp: StartingPoint) => {
    setFormName(sp.name);
    setFormLat(String(sp.latitude));
    setFormLon(String(sp.longitude));
    setFormDesc(sp.description || '');
    setEditingUid(sp.uid);
    setShowForm(true);
    setFormError(null);
  };

  const handleSubmit = () => {
    setFormError(null);
    const name = formName.trim();
    if (!name) {
      setFormError('Starting point name is required.');
      return;
    }

    // Check for duplicate names
    const duplicate = startingPoints.find(
      (sp) => sp.name.toLowerCase() === name.toLowerCase() && sp.uid !== editingUid
    );
    if (duplicate) {
      setFormError(`A starting point named "${name}" already exists.`);
      return;
    }

    const lat = Number(formLat.trim());
    const lon = Number(formLon.trim());

    if (isNaN(lat) || formLat.trim() === '') {
      setFormError('Enter a valid latitude value.');
      return;
    }
    if (isNaN(lon) || formLon.trim() === '') {
      setFormError('Enter a valid longitude value.');
      return;
    }
    if (lat < -90 || lat > 90) {
      setFormError('Latitude must be between -90 and +90.');
      return;
    }
    if (lon < -180 || lon > 180) {
      setFormError('Longitude must be between -180 and +180.');
      return;
    }

    if (editingUid) {
      const existing = startingPoints.find((sp) => sp.uid === editingUid);
      onUpdate({
        uid: editingUid,
        name,
        latitude: lat,
        longitude: lon,
        description: formDesc.trim() || undefined,
        source: existing?.source || 'manual',
      });
    } else {
      onAdd({
        uid: generateUid(),
        name,
        latitude: lat,
        longitude: lon,
        description: formDesc.trim() || undefined,
        source: 'manual',
      });
    }

    resetForm();
  };

  return (
    <div className="rm-sp-manager">
      <div className="rm-sp-manager-header">
        <h3>Starting Points</h3>
        <button className="rm-sp-close-btn" onClick={onClose} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <p className="rm-sp-manager-desc">
        Manage the starting/reference points used to measure distances to destination sites.
      </p>

      {/* Existing starting points list */}
      <div className="rm-sp-list">
        {startingPoints.length === 0 && !showForm && (
          <div className="rm-sp-empty">
            No starting points defined yet. Add one to begin assigning destinations.
          </div>
        )}

        {startingPoints.map((sp) => (
          <div key={sp.uid} className="rm-sp-item">
            <div className="rm-sp-item-info">
              <div className="rm-sp-item-name">{sp.name}</div>
              <div className="rm-sp-item-coords">
                {sp.latitude.toFixed(6)}, {sp.longitude.toFixed(6)}
              </div>
              {sp.description && (
                <div className="rm-sp-item-desc">{sp.description}</div>
              )}
              <div className={`rm-sp-item-source rm-sp-source-${sp.source}`}>
                {sp.source === 'manual' ? 'Manual' : sp.source === 'detected' ? 'Detected' : 'Workbook'}
              </div>
            </div>
            <div className="rm-sp-item-actions">
              <button
                className="rm-sp-action-btn"
                onClick={() => startEdit(sp)}
                title="Edit"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {sp.source === 'manual' && (
                <button
                  className="rm-sp-action-btn rm-sp-action-delete"
                  onClick={() => onRemove(sp.uid)}
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rm-sp-form">
          <div className="rm-sp-form-title">
            {editingUid ? 'Edit Starting Point' : 'New Starting Point'}
          </div>

          {formError && (
            <div className="rm-sp-form-error">{formError}</div>
          )}

          <div className="rm-sp-form-grid">
            <div className="rm-sp-form-field">
              <label>Name *</label>
              <input
                type="text"
                placeholder="e.g. Amanzi Warehouse"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="rm-sp-form-row">
              <div className="rm-sp-form-field">
                <label>Latitude *</label>
                <input
                  type="text"
                  placeholder="-6.795598"
                  value={formLat}
                  onChange={(e) => setFormLat(e.target.value)}
                />
              </div>
              <div className="rm-sp-form-field">
                <label>Longitude *</label>
                <input
                  type="text"
                  placeholder="39.216737"
                  value={formLon}
                  onChange={(e) => setFormLon(e.target.value)}
                />
              </div>
            </div>

            <div className="rm-sp-form-field">
              <label>Description</label>
              <input
                type="text"
                placeholder="Optional description"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="rm-sp-form-actions">
            <button className="rm-sp-form-cancel" onClick={resetForm}>Cancel</button>
            <button className="rm-sp-form-save" onClick={handleSubmit}>
              {editingUid ? 'Update' : 'Add Starting Point'}
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button className="rm-sp-add-btn" onClick={() => { setEditingUid(null); setShowForm(true); }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Add Starting Point
        </button>
      )}
    </div>
  );
}
