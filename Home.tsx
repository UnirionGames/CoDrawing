/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
import {Content, GoogleGenAI, Modality} from '@google/genai';
import {
  ChevronDown,
  Copy,
  LoaderCircle,
  Redo2,
  SendHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

function parseError(error: string) {
  const regex = /{"error":(.*)}/gm;
  const m = regex.exec(error);
  try {
    const e = m[1];
    const err = JSON.parse(e);
    return err.message || error;
  } catch (e) {
    return error;
  }
}

export default function Home() {
  const canvasRef = useRef(null);
  const backgroundImageRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(16);
  const [similarity, setSimilarity] = useState(0.5);
  const colorInputRef = useRef(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(
    'gemini-2.5-flash-image-preview',
  );
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursorPosition, setCursorPosition] = useState({x: 0, y: 0});
  const [isCursorVisible, setIsCursorVisible] = useState(false);

  // Load background image when generatedImage changes
  useEffect(() => {
    if (generatedImage && canvasRef.current) {
      // Use the window.Image constructor to avoid conflict with Next.js Image component
      const img = new window.Image();
      img.onload = () => {
        backgroundImageRef.current = img;
        drawImageToCanvas();
        saveCanvasState(); // Save state after generation
      };
      img.src = generatedImage;
    }
  }, [generatedImage]);

  // Save canvas state to history
  const saveCanvasState = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(dataURL);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Restore canvas state from history
  const restoreCanvasState = (dataURL: string) => {
    if (!canvasRef.current || !dataURL) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataURL;
  };

  // Handle Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      restoreCanvasState(history[newIndex]);
    }
  };

  // Handle Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      restoreCanvasState(history[newIndex]);
    }
  };

  // Initialize canvas with white background when component mounts
  useEffect(() => {
    if (canvasRef.current) {
      initializeCanvas();
      // Save the initial blank state
      const canvas = canvasRef.current as HTMLCanvasElement;
      const dataUrl = canvas.toDataURL();
      setHistory([dataUrl]);
      setHistoryIndex(0);
    }
  }, []);

  // Initialize canvas with white background
  const initializeCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Draw the background image to the canvas
  const drawImageToCanvas = () => {
    if (!canvasRef.current || !backgroundImageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill with white background first
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the background image
    ctx.drawImage(
      backgroundImageRef.current,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  };

  // Get the correct coordinates based on canvas scaling
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Calculate the scaling factor between the internal canvas size and displayed size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Apply the scaling to get accurate coordinates
    return {
      x:
        (e.nativeEvent.offsetX ||
          e.nativeEvent.touches?.[0]?.clientX - rect.left) * scaleX,
      y:
        (e.nativeEvent.offsetY ||
          e.nativeEvent.touches?.[0]?.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);

    // Prevent default behavior to avoid scrolling on touch devices
    if (e.type === 'touchstart') {
      e.preventDefault();
    }

    // Start a new path without clearing the canvas
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    // Prevent default behavior to avoid scrolling on touch devices
    if (e.type === 'touchmove') {
      e.preventDefault();
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const {x, y} = getCoordinates(e);

    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round'; // Fix for sharp corner artifacts
    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return; // Only save if we were actually drawing
    setIsDrawing(false);
    saveCanvasState();
  };

  const handleMouseEnter = () => {
    setIsCursorVisible(true);
  };

  const handleMouseLeave = () => {
    stopDrawing();
    setIsCursorVisible(false);
  };

  const handleMouseMove = (e) => {
    setCursorPosition({x: e.clientX, y: e.clientY});
    draw(e);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Fill with white instead of just clearing
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    setGeneratedImage(null);
    backgroundImageRef.current = null;
    saveCanvasState();
  };

  const handleColorChange = (e) => {
    setPenColor(e.target.value);
  };

  const openColorPicker = () => {
    if (colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      openColorPicker();
    }
  };

  const getSimilarityInstruction = (level: number): string => {
    if (level <= 0.2) {
      return 'Be highly creative and take inspiration from the drawing, but feel free to reinterpret it completely.';
    }
    if (level <= 0.4) {
      return 'Be creative and use the drawing as a loose guide.';
    }
    if (level <= 0.6) {
      return 'Balance the original drawing with creative interpretation.';
    }
    if (level <= 0.8) {
      return 'Adhere closely to the lines and shapes in the drawing.';
    }
    return 'Replicate the drawing as precisely as possible, only adding details and textures based on the prompt.';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canvasRef.current) return;

    setIsLoading(true);

    try {
      // Get the drawing as base64 data
      const canvas = canvasRef.current;

      // Create a temporary canvas to add white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Fill with white background
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw the original canvas content on top of the white background
      tempCtx.drawImage(canvas, 0, 0);

      const drawingData = tempCanvas.toDataURL('image/png').split(',')[1];

      // Create request payload
      const requestPayload = {
        prompt,
        drawingData,
        customApiKey, // Add the custom API key to the payload if it exists
      };

      // Log the request payload (without the full image data for brevity)
      console.log('Request payload:', {
        ...requestPayload,
        drawingData: drawingData
          ? `${drawingData.substring(0, 50)}... (truncated)`
          : null,
        customApiKey: customApiKey ? '**********' : null,
      });

      let contents: Content[] = [
        {
          role: 'USER',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      if (drawingData) {
        const similarityInstruction = getSimilarityInstruction(similarity);
        contents = [
          {
            role: 'USER',
            parts: [{inlineData: {data: drawingData, mimeType: 'image/png'}}],
          },
          {
            role: 'USER',
            parts: [
              {
                text: `${prompt}. ${similarityInstruction} Keep the same minimal line drawing style.`,
              },
            ],
          },
        ];
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      const data = {
        success: true,
        message: '',
        imageData: null,
        error: undefined,
      };

      for (const part of response.candidates[0].content.parts) {
        // Based on the part type, either get the text or image data
        if (part.text) {
          data.message = part.text;
          console.log('Received text response:', part.text);
        } else if (part.inlineData) {
          const imageData = part.inlineData.data;
          console.log('Received image data, length:', imageData.length);

          // Include the base64 data in the response
          data.imageData = imageData;
        }
      }

      // Log the response (without the full image data for brevity)
      console.log('Response:', {
        ...data,
        imageData: data.imageData
          ? `${data.imageData.substring(0, 50)}... (truncated)`
          : null,
      });

      if (data.success && data.imageData) {
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        setGeneratedImage(imageUrl);
      } else {
        console.error('Failed to generate image:', data.error);
        alert('Failed to generate image. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting drawing:', error);
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Close the error modal
  const closeErrorModal = () => {
    setShowErrorModal(false);
  };

  // Handle the custom API key submission
  const handleApiKeySubmit = (e) => {
    e.preventDefault();
    setShowErrorModal(false);
    // Will use the customApiKey state in the next API call
  };

  // Add touch event prevention function
  useEffect(() => {
    // Function to prevent default touch behavior on canvas
    const preventTouchDefault = (e) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    // Add event listener when component mounts
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('touchstart', preventTouchDefault, {
        passive: false,
      });
      canvas.addEventListener('touchmove', preventTouchDefault, {
        passive: false,
      });
    }

    // Remove event listener when component unmounts
    return () => {
      if (canvas) {
        canvas.removeEventListener('touchstart', preventTouchDefault);
        canvas.removeEventListener('touchmove', preventTouchDefault);
      }
    };
  }, [isDrawing]);

  return (
    <>
      {isCursorVisible && (
        <div
          className="pointer-events-none fixed rounded-full border border-gray-500"
          style={{
            width: `${lineWidth}px`,
            height: `${lineWidth}px`,
            left: `${cursorPosition.x}px`,
            top: `${cursorPosition.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
      <div className="min-h-screen notebook-paper-bg text-gray-900 flex flex-col justify-start items-center">
        <main className="container mx-auto px-3 sm:px-6 py-5 sm:py-10 pb-32 max-w-5xl w-full">
          {/* Header section with title and tools */}
          <div className="flex flex-col mb-4 sm:mb-6 gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-0 leading-tight font-mega text-center">
                Gemini Co-Drawing
              </h1>
            </div>

            <menu className="flex flex-wrap items-center justify-center bg-gray-300 rounded-xl p-2 shadow-sm gap-2 w-full">
              <div className="relative" title="Select Gemini Model">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-10 rounded-full bg-white pl-3 pr-8 text-sm text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 appearance-none border-2 border-white"
                  aria-label="Select Gemini Model">
                  <option value="gemini-2.5-flash-image-preview">
                    2.5 Flash
                  </option>
                  <option value="gemini-2.0-flash-preview-image-generation">
                    2.0 Flash
                  </option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>

              {/* Line Width Slider */}
              <div
                className="flex items-center bg-white rounded-full h-10 px-3 shadow-sm border-2 border-white"
                title="Adjust Brush Size">
                <label htmlFor="lineWidth" className="sr-only">
                  Line Width
                </label>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-600">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                <input
                  id="lineWidth"
                  type="range"
                  min="1"
                  max="50"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="w-20 sm:w-24 mx-2 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-700"
                  aria-label="Select line width"
                />
                <span className="text-sm text-gray-700 font-mono w-8 text-center">
                  {lineWidth}px
                </span>
              </div>

              {/* Similarity Slider */}
              <div
                className="flex items-center bg-white rounded-full h-10 px-3 shadow-sm border-2 border-white"
                title="Adjust AI Similarity">
                <label htmlFor="similarity" className="sr-only">
                  Similarity
                </label>
                <Copy className="text-gray-600 w-5 h-5" aria-hidden="true" />
                <input
                  id="similarity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={similarity}
                  onChange={(e) => setSimilarity(Number(e.target.value))}
                  className="w-20 sm:w-24 mx-2 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-700"
                  aria-label="Select similarity level"
                />
                <span className="text-sm text-gray-700 font-mono w-8 text-center">
                  {similarity.toFixed(1)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                aria-label="Undo"
                title="Undo Last Action">
                <Undo2 className="w-5 h-5 text-gray-700" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                aria-label="Redo"
                title="Redo Last Action">
                <Redo2 className="w-5 h-5 text-gray-700" />
              </button>
              <button
                type="button"
                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center border-2 border-white shadow-sm transition-transform hover:scale-110"
                onClick={openColorPicker}
                onKeyDown={handleKeyDown}
                aria-label="Open color picker"
                style={{backgroundColor: penColor}}
                title="Select Brush Color">
                <input
                  ref={colorInputRef}
                  type="color"
                  value={penColor}
                  onChange={handleColorChange}
                  className="opacity-0 absolute w-px h-px"
                  aria-label="Select pen color"
                />
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-sm transition-all hover:bg-gray-50 hover:scale-110"
                title="Clear Canvas">
                <Trash2
                  className="w-5 h-5 text-gray-700"
                  aria-label="Clear Canvas"
                />
              </button>
            </menu>
          </div>

          {/* Canvas section with notebook paper background */}
          <div className="w-full mb-6">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              onMouseDown={startDrawing}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrawing}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleMouseEnter}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="border-2 border-black w-full cursor-none sm:h-[60vh] h-[30vh] min-h-[320px] bg-white/90 touch-none"
            />
          </div>

          {/* Input form that matches canvas width */}
          <form onSubmit={handleSubmit} className="w-full">
            <div className="relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Add your change..."
                className="w-full p-3 sm:p-4 pr-12 sm:pr-14 text-sm sm:text-base border-2 border-black bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-gray-200 focus:outline-none transition-all font-mono"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 rounded-none bg-black text-white hover:cursor-pointer hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
                {isLoading ? (
                  <LoaderCircle
                    className="w-5 sm:w-6 h-5 sm:h-6 animate-spin"
                    aria-label="Loading"
                  />
                ) : (
                  <SendHorizontal
                    className="w-5 sm:w-6 h-5 sm:h-6"
                    aria-label="Submit"
                  />
                )}
              </button>
            </div>
          </form>
        </main>
        {/* Error Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-700">
                  Failed to generate
                </h3>
                <button
                  onClick={closeErrorModal}
                  className="text-gray-400 hover:text-gray-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="font-medium text-gray-600">
                {parseError(errorMessage)}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
