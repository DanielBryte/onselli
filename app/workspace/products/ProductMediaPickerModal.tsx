'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  FileArchive,
  FilePlus2,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  LoaderCircle,
  Music,
  Search,
  Upload,
  X,
} from 'lucide-react';
import Dialog from '@/app/components/ui/Dialog';
import Button from '@/app/components/ui/Button';

export type MediaAsset = {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: string;
  previewUrl: string | null;
};

export type ProductMediaPickerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  maxFiles?: number;
  maxFileBytes?: number;
  acceptedFileTypes?: string;
  alreadyAddedAssetIds?: string[];
  initialSelectedAssetIds?: string[];
  onAttachSelected: (selectedAssetIds: string[], selectedAssets: MediaAsset[]) => void | Promise<void>;
  onUploadFromComputer?: (files: File[]) => void | Promise<void>;
  busy?: boolean;
  /** When true, the modal operates in single-select mode (pick one image for a cover, etc.) */
  singleMode?: boolean;
  /** Called in singleMode when the user picks an asset from the library */
  onSelectLibraryAsset?: (asset: MediaAsset) => void;
};

const DEFAULT_ACCEPTED =
  '.pdf,.zip,.epub,.docx,.pptx,.xlsx,.mp3,.m4a,.wav,.ogg,.mp4,.mov,.webm,.png,.jpg,.jpeg,.webp,.gif';

function formatFileSize(bytes: number | string): string {
  const num = Number(bytes);
  if (isNaN(num) || num <= 0) return '0 B';
  if (num < 1024 * 1024) {
    return `${(num / 1024).toFixed(1)} KB`;
  }
  return `${(num / (1024 * 1024)).toFixed(num < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}

function getAssetIcon(contentType: string) {
  const mime = contentType.toLowerCase();
  if (mime.startsWith('image/')) return <ImageIcon size={20} aria-hidden="true" />;
  if (mime.startsWith('audio/')) return <Music size={20} aria-hidden="true" />;
  if (mime.startsWith('video/')) return <Film size={20} aria-hidden="true" />;
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('archive') || mime.includes('compressed')) {
    return <FileArchive size={20} aria-hidden="true" />;
  }
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text') || mime.includes('epub')) {
    return <FileText size={20} aria-hidden="true" />;
  }
  return <FilePlus2 size={20} aria-hidden="true" />;
}

export default function ProductMediaPickerModal({
  open,
  onOpenChange,
  title = 'Add files to your product',
  subtitle = 'Upload from your computer or reuse files already in your Media Library.',
  maxFiles = 20,
  maxFileBytes = 100 * 1024 * 1024,
  acceptedFileTypes = DEFAULT_ACCEPTED,
  alreadyAddedAssetIds = [],
  initialSelectedAssetIds = [],
  onAttachSelected,
  onUploadFromComputer,
  busy = false,
  singleMode = false,
  onSelectLibraryAsset,
}: ProductMediaPickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'audio' | 'video' | 'document'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedAssetIds);
  const [isDragging, setIsDragging] = useState(false);

  // In single mode, force type filter to 'image' if acceptedFileTypes only has images
  const isImageOnly = useMemo(() => {
    if (!singleMode) return false;
    const types = acceptedFileTypes.toLowerCase();
    return (
      types.includes('image') &&
      !types.includes('audio') &&
      !types.includes('video') &&
      !types.includes('pdf') &&
      !types.includes('zip') &&
      !types.includes('doc')
    );
  }, [singleMode, acceptedFileTypes]);

  // Sync initial selection when modal opens
  useEffect(() => {
    if (open) {
      setSelectedIds(singleMode ? [] : initialSelectedAssetIds);
      setSearch('');
      setTypeFilter(isImageOnly ? 'image' : 'all');
      setLoadError('');
    }
  }, [open, initialSelectedAssetIds, singleMode, isImageOnly]);

  // Load Media Library assets when modal opens
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/workspace/media', { cache: 'no-store' });
      const payload = (await response.json().catch(() => ({}))) as {
        assets?: MediaAsset[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || 'Could not load Media Library.');
      }
      setAssets(payload.assets ?? []);
      setLoadedOnce(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load Media Library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !loadedOnce) {
      void fetchAssets();
    }
  }, [open, loadedOnce, fetchAssets]);

  // Filtered asset list — in image-only single mode, only show images
  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const mime = asset.contentType.toLowerCase();
      const matchesType = (() => {
        if (isImageOnly) return mime.startsWith('image/');
        return (
          typeFilter === 'all' ||
          (typeFilter === 'image'
            ? mime.startsWith('image/')
            : typeFilter === 'audio'
              ? mime.startsWith('audio/')
              : typeFilter === 'video'
                ? mime.startsWith('video/')
                : !mime.startsWith('image/') && !mime.startsWith('audio/') && !mime.startsWith('video/'))
        );
      })();
      const matchesSearch = !query || asset.name.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [assets, search, typeFilter, isImageOnly]);

  // Selection toggle — in single mode, selecting immediately confirms
  const toggleSelect = useCallback(
    (assetId: string) => {
      if (alreadyAddedAssetIds.includes(assetId)) return;
      if (singleMode) {
        // Single mode: immediately fire callback and close
        const asset = assets.find((a) => a.id === assetId);
        if (asset && onSelectLibraryAsset) {
          onSelectLibraryAsset(asset);
        }
        onOpenChange(false);
        return;
      }
      setSelectedIds((current) => {
        if (current.includes(assetId)) {
          return current.filter((id) => id !== assetId);
        }
        if (alreadyAddedAssetIds.length + current.length >= maxFiles) {
          return current;
        }
        return [...current, assetId];
      });
    },
    [alreadyAddedAssetIds, maxFiles, singleMode, assets, onSelectLibraryAsset, onOpenChange],
  );

  // Handle local file uploads
  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const allFiles = Array.from(fileList);
    const files: File[] = singleMode ? (allFiles[0] ? [allFiles[0]] : []) : allFiles;
    if (files.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onUploadFromComputer) {
      void onUploadFromComputer(files);
      onOpenChange(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const maxFilesRemaining = singleMode ? 1 : Math.max(0, maxFiles - alreadyAddedAssetIds.length);
  const isCapReached = !singleMode && selectedIds.length >= maxFilesRemaining;

  const handleConfirm = () => {
    if (selectedIds.length === 0 || busy) return;
    const selectedAssets = assets.filter((asset) => selectedIds.includes(asset.id));
    void onAttachSelected(selectedIds, selectedAssets);
  };

  // Filter pills — hidden in image-only single mode (no need to filter)
  const filterPills = isImageOnly
    ? []
    : ([
        { id: 'all', label: 'All' },
        { id: 'image', label: 'Images' },
        { id: 'audio', label: 'Audio' },
        { id: 'video', label: 'Video' },
        { id: 'document', label: 'Documents' },
      ] as const);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      describedBy="product-media-picker-desc"
      className="product-media-picker-modal"
      overlayClassName="media-folder-dialog"
    >
      <div className="product-media-picker">
        {/* Header */}
        <header className="product-media-picker__header">
          <div>
            <h2 id="product-media-picker-title">{title}</h2>
            <p id="product-media-picker-desc">{subtitle}</p>
          </div>
          <button
            type="button"
            className="product-media-picker__close"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X size={18} />
          </button>
        </header>

        {/* Upload from Computer Box */}
        <input
          ref={fileInputRef}
          type="file"
          multiple={!singleMode}
          accept={acceptedFileTypes}
          onChange={(e) => handleFilesSelected(e.target.files)}
          hidden
        />
        <div
          role="button"
          tabIndex={0}
          className={`product-media-picker__upload-card ${isDragging ? 'is-dragging' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Upload files from computer"
        >
          <div className="product-media-picker__upload-icon">
            <Upload size={20} />
          </div>
          <div className="product-media-picker__upload-info">
            <strong>Upload from computer</strong>
            <small>
              {singleMode
                ? `Choose an image from this device · up to ${Math.round(maxFileBytes / 1024 / 1024)} MB`
                : `Choose files from this device · up to ${Math.round(maxFileBytes / 1024 / 1024)} MB each`}
            </small>
          </div>
        </div>

        {/* Media Library Section */}
        <div className="product-media-picker__library-bar">
          <div className="product-media-picker__library-title">
            <FolderOpen size={17} className="product-media-picker__folder-icon" />
            <span>Media Library</span>
          </div>
          <span className="product-media-picker__library-hint">
            {singleMode
              ? 'Pick an existing image — no duplicate upload'
              : 'Select existing uploads without creating another copy'}
          </span>
        </div>

        {/* Search & Filter Controls */}
        <div className="product-media-picker__toolbar">
          <div className="product-media-picker__search">
            <Search size={16} className="product-media-picker__search-icon" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your files"
              aria-label="Search your files"
            />
            {search && (
              <button
                type="button"
                className="product-media-picker__search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {filterPills.length > 0 && (
            <div className="product-media-picker__filters" role="group" aria-label="Filter media by type">
              {filterPills.map(({ id, label }) => {
                const isActive = typeFilter === id;
                return (
                  <button
                    type="button"
                    key={id}
                    className={`product-media-picker__filter-pill ${isActive ? 'is-active' : ''}`}
                    aria-pressed={isActive}
                    onClick={() => setTypeFilter(id)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Error State */}
        {loadError && (
          <div className="product-media-picker__error" role="alert">
            <span>{loadError}</span>
            <button type="button" onClick={() => void fetchAssets()}>
              Try again
            </button>
          </div>
        )}

        {/* Assets List */}
        <div
          className={`product-media-picker__list ${loading ? 'is-loading' : ''}`}
          aria-live="polite"
          aria-busy={loading}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="product-media-picker__skeleton" aria-hidden="true">
                <span className="product-media-picker__skeleton-checkbox" />
                <span className="product-media-picker__skeleton-thumb" />
                <div className="product-media-picker__skeleton-text">
                  <span className="product-media-picker__skeleton-line is-title" />
                  <span className="product-media-picker__skeleton-line is-meta" />
                </div>
              </div>
            ))
          ) : filteredAssets.length > 0 ? (
            filteredAssets.map((asset) => {
              const isAlreadyAdded = !singleMode && alreadyAddedAssetIds.includes(asset.id);
              const isSelected = selectedIds.includes(asset.id);
              const isDisabled = isAlreadyAdded || (!singleMode && isCapReached && !isSelected) || busy;

              return (
                <label
                  key={asset.id}
                  className={`product-media-picker__row ${
                    isAlreadyAdded
                      ? 'is-already-added'
                      : isSelected
                        ? 'is-selected'
                        : ''
                  } ${isDisabled ? 'is-disabled' : ''} ${singleMode ? 'is-single-mode' : ''}`}
                  onClick={singleMode ? () => toggleSelect(asset.id) : undefined}
                  style={singleMode ? { cursor: 'pointer' } : undefined}
                >
                  {!singleMode && (
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected || isAlreadyAdded}
                      disabled={isDisabled}
                      onChange={() => toggleSelect(asset.id)}
                    />
                  )}

                  {/* Checkbox — hidden in single mode */}
                  {!singleMode && (
                    <div
                      className={`product-media-picker__checkbox ${
                        isAlreadyAdded
                          ? 'is-added'
                          : isSelected
                            ? 'is-checked'
                            : ''
                      } ${isDisabled ? 'is-disabled' : ''}`}
                      aria-hidden="true"
                    >
                      {(isSelected || isAlreadyAdded) && (
                        <Check size={12} strokeWidth={3} className="product-media-picker__check-icon" />
                      )}
                    </div>
                  )}

                  {/* Thumbnail / Type Icon */}
                  <div className="product-media-picker__thumb">
                    {asset.previewUrl ? (
                      <img src={asset.previewUrl} alt="" loading="lazy" />
                    ) : (
                      getAssetIcon(asset.contentType)
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="product-media-picker__meta">
                    <strong title={asset.name}>{asset.name}</strong>
                    <small>
                      {asset.contentType} · {formatFileSize(asset.sizeBytes)}
                    </small>
                  </div>

                  {/* Status Badge */}
                  {isAlreadyAdded && (
                    <span className="product-media-picker__badge is-added">Added</span>
                  )}
                  {isSelected && !isAlreadyAdded && !singleMode && (
                    <span className="product-media-picker__badge is-selected">Selected</span>
                  )}
                  {singleMode && (
                    <span className="product-media-picker__badge is-use">Use</span>
                  )}
                </label>
              );
            })
          ) : (
            <div className="product-media-picker__empty">
              {assets.length === 0 ? (
                <p>No files in your Media Library yet. Upload files above to get started.</p>
              ) : (
                <p>No files match &ldquo;{search}&rdquo; in this category.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="product-media-picker__footer">
          <div className="product-media-picker__footer-info">
            {singleMode ? (
              <span>Click a file to use it, or upload a new image above.</span>
            ) : selectedIds.length > 0 ? (
              <span>
                <strong>{selectedIds.length}</strong> {selectedIds.length === 1 ? 'file' : 'files'} selected
                {alreadyAddedAssetIds.length > 0 && ` (${alreadyAddedAssetIds.length} already attached)`}
              </span>
            ) : (
              <span>
                Select up to {maxFilesRemaining} {maxFilesRemaining === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>
          <div className="product-media-picker__footer-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            {!singleMode && (
              <button
                type="button"
                className="product-media-picker__submit-btn"
                disabled={selectedIds.length === 0 || busy}
                onClick={handleConfirm}
              >
                {busy ? (
                  <>
                    Adding… <LoaderCircle size={15} className="animate-spin" />
                  </>
                ) : selectedIds.length > 0 ? (
                  `Add selected (${selectedIds.length})`
                ) : (
                  'Add selected'
                )}
              </button>
            )}
          </div>
        </footer>
      </div>
    </Dialog>
  );
}
