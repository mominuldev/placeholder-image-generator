import { useState, useRef } from 'react'
import JSZip from 'jszip'
import './App.css'

function App() {
  const [images, setImages] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)

  const handleFileUpload = async (files) => {
    const filesArray = Array.from(files)

    if (filesArray.length === 0) return

    const validFiles = filesArray.filter(file => file.type.startsWith('image/'))
    if (validFiles.length === 0) {
      alert('Please select valid image files')
      return
    }

    setIsProcessing(true)
    setOverallProgress(0)

    const initialImages = validFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      originalUrl: null,
      placeholderUrl: null,
      dimensions: null,
      progress: 0
    }))

    setImages(initialImages)

    // Process images one by one
    for (let i = 0; i < initialImages.length; i++) {
      await processImage(initialImages[i], i, initialImages.length)
      setOverallProgress(Math.round(((i + 1) / initialImages.length) * 100))
    }

    setIsProcessing(false)
  }

  const processImage = (imageObj, index, total) => {
    return new Promise((resolve) => {
      const reader = new FileReader()

      reader.onload = (event) => {
        const img = new Image()

        img.onload = () => {
          const width = img.width
          const height = img.height

          // Update image with original
          setImages(prev => prev.map(img => {
            if (img.id === imageObj.id) {
              return {
                ...img,
                status: 'processing',
                originalUrl: event.target.result,
                dimensions: { width, height },
                progress: 50
              }
            }
            return img
          }))

          // Generate placeholder
          const placeholderUrl = generatePlaceholder(width, height)

          // Update image with placeholder
          setTimeout(() => {
            setImages(prev => prev.map(img => {
              if (img.id === imageObj.id) {
                return {
                  ...img,
                  status: 'completed',
                  placeholderUrl,
                  progress: 100
                }
              }
              return img
            }))
            resolve()
          }, 100)
        }

        img.onerror = () => {
          setImages(prev => prev.map(img => {
            if (img.id === imageObj.id) {
              return {
                ...img,
                status: 'error',
                progress: 0
              }
            }
            return img
          }))
          resolve()
        }

        img.src = event.target.result
      }

      reader.readAsDataURL(imageObj.file)
    })
  }

  const generatePlaceholder = (width, height) => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    canvas.width = width
    canvas.height = height

    // Create a gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#e0e7ff')
    gradient.addColorStop(1, '#c7d2fe')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // Add diagonal stripes pattern
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)'
    ctx.lineWidth = 2
    const stripeSpacing = 40
    for (let i = -height; i < width; i += stripeSpacing) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i + height, height)
      ctx.stroke()
    }

    // Add text with dimensions
    const fontSize = Math.max(16, Math.min(width, height) / 15)
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`
    ctx.fillStyle = '#4f46e5'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const text = `${width} × ${height}`
    ctx.fillText(text, width / 2, height / 2)
    ctx.font = `${fontSize * 0.5}px system-ui, sans-serif`
    ctx.fillStyle = '#6366f1'
    ctx.fillText('Placeholder Image', width / 2, height / 2 + fontSize * 0.8)

    return canvas.toDataURL('image/png')
  }

  const handleDownloadSingle = (image) => {
    if (image.placeholderUrl) {
      const link = document.createElement('a')
      link.href = image.placeholderUrl

      // Get original filename without extension
      const originalName = image.file.name.replace(/\.[^/.]+$/, '')
      link.download = `${originalName}.png`

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDownloadAllAsZip = async () => {
    const completedImages = images.filter(img => img.status === 'completed' && img.placeholderUrl)

    if (completedImages.length === 0) {
      alert('No completed images to download')
      return
    }

    try {
      const zip = new JSZip()

      completedImages.forEach((image) => {
        const base64Data = image.placeholderUrl.split(',')[1]
        // Get original filename without extension
        const originalName = image.file.name.replace(/\.[^/.]+$/, '')
        const fileName = `${originalName}.png`
        zip.file(fileName, base64Data, { base64: true })
      })

      const content = await zip.generateAsync({ type: 'blob' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(content)
      link.download = `placeholder-images-${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('Error creating ZIP:', error)
      alert('Error creating ZIP file')
    }
  }

  const handleReset = () => {
    setImages([])
    setIsProcessing(false)
    setOverallProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isProcessing) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isProcessing) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (isProcessing) return

    const files = e.dataTransfer.files
    handleFileUpload(files)
  }

  const handleFileInputChange = (e) => {
    handleFileUpload(e.target.files)
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing':
        return (
          <svg className="spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
          </svg>
        )
      case 'completed':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="success-icon">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )
      case 'error':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="error-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        )
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pending-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        )
    }
  }

  const completedCount = images.filter(img => img.status === 'completed').length
  const totalCount = images.length
  const canDownloadZip = completedCount > 0 && !isProcessing

  return (
    <div className="app">
      <div className="container">
        <h1>Placeholder Image Generator</h1>
        <p className="subtitle">Upload multiple images to generate same-size placeholders</p>

        {/* Drag and Drop Zone */}
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''} ${isProcessing ? 'disabled' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInputChange}
            className="file-input"
            id="file-upload"
            disabled={isProcessing}
          />

          <div className="drop-zone-content">
            <div className="drop-zone-icon">
              {isDragging ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                  <path d="M12 15 L12 15" strokeWidth="3"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              )}
            </div>

            <div className="drop-zone-text">
              <p className="drop-zone-title">
                {isDragging ? 'Drop your images here' : 'Drag & drop images here'}
              </p>
              <p className="drop-zone-subtitle">
                or <button onClick={handleBrowseClick} className="browse-button" disabled={isProcessing}>browse files</button> from your computer
              </p>
              <p className="drop-zone-hint">
                Supports PNG, JPG, GIF, WebP and more
              </p>
            </div>
          </div>
        </div>

        {/* Overall Progress */}
        {isProcessing && (
          <div className="overall-progress">
            <div className="progress-header">
              <span>Processing images...</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${overallProgress}%` }}></div>
            </div>
          </div>
        )}

        {/* Images List */}
        {images.length > 0 && (
          <div className="preview-section">
            <div className="images-list">
              {images.map((image, index) => (
                <div key={image.id} className="image-item">
                  <div className="image-item-header">
                    <div className="image-info">
                      <span className="image-number">#{index + 1}</span>
                      <span className="image-name">{image.file.name}</span>
                    </div>
                    <div className={`status-badge status-${image.status}`}>
                      {getStatusIcon(image.status)}
                      <span>{image.status.charAt(0).toUpperCase() + image.status.slice(1)}</span>
                    </div>
                  </div>

                  {image.status !== 'pending' && (
                    <div className="image-preview-grid">
                      <div className="preview-card">
                        <h4>Original</h4>
                        <div className="preview-wrapper">
                          <img src={image.originalUrl} alt="Original" />
                        </div>
                        {image.dimensions && (
                          <p className="preview-dimensions">
                            {image.dimensions.width} × {image.dimensions.height}px
                          </p>
                        )}
                      </div>

                      {image.placeholderUrl && (
                        <div className="preview-card">
                          <h4>Placeholder</h4>
                          <div className="preview-wrapper">
                            <img src={image.placeholderUrl} alt="Placeholder" />
                          </div>
                          <button
                            onClick={() => handleDownloadSingle(image)}
                            className="download-single-button"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Download
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="action-buttons">
              {canDownloadZip && (
                <button onClick={handleDownloadAllAsZip} className="download-zip-button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download All as ZIP ({completedCount} images)
                </button>
              )}
              <button onClick={handleReset} className="reset-button" disabled={isProcessing}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"></path>
                  <path d="M3 3v9h9"></path>
                </svg>
                {images.length > 0 ? 'Upload New Images' : 'Clear'}
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}

export default App
