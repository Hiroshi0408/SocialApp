import React, { useState } from 'react';
import axios from 'axios';
import './CreateGroupModal.css';

function CreateGroupModal({ isOpen, onClose, onGroupCreated }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    function handleImageChange(e) {
        const file = e.target.files?.[0] ?? null;
        setImageFile(file);
        if (!file) return setPreview(null);
        const reader = new FileReader();
        reader.onload = () => setPreview(reader.result);
        reader.readAsDataURL(file);
    }

    async function handleCreateGroup(e) {
        e.preventDefault();
        setError(null);
        if (!name.trim()) return setError('Group name is required.');
        setLoading(true);
        try {
        const form = new FormData();
        form.append('name', name);
        form.append('description', description);
        if (imageFile) form.append('image', imageFile);
        const res = await axios.post('/api/groups', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        const newGroup = res?.data ?? {
            id: Date.now(),
            name,
            description,
            image: preview,
        };
        onGroupCreated(newGroup);
        setName('');
        setDescription('');
        setImageFile(null);
        setPreview(null);
        onClose();
        } catch (err) {
        setError(err?.response?.data?.message || 'Failed to create group.');
        } finally {
        setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="modal-overlay cgm-scoped" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
            <h2>Create New Group</h2>
            <button className="modal-close" onClick={onClose}>✕</button>
            </div>
            <form onSubmit={handleCreateGroup} id="create-group-form" className="create-form">
            <div className="form-group">
                <label htmlFor="group-name">Group Name</label>
                <input
                id="group-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter group name"
                />
            </div>
            <div className="form-group">
                <label htmlFor="group-description">Description</label>
                <textarea
                id="group-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter group description"
                rows="4"
                />
            </div>
            <div className="form-group">
                <label htmlFor="group-image">Group Image</label>
                <input
                id="group-image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                />
            </div>
            <div className="preview-container">
                {preview && <img src={preview} alt="preview" className="group-preview" />}
            </div>
            {error && <div className="error-message">{error}</div>}
            </form>
            <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
                </button>
                <button type="submit" form="create-group-form" className="btn-create" disabled={loading}>
                {loading ? 'Creating...' : 'Create Group'}
                </button>
            </div>
        </div>
        </div>
    );
}

export default CreateGroupModal;
