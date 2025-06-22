import React, { useState } from 'react';
import { Upload, FileText, X, Edit2, Check, XCircle, Download } from 'lucide-react';


const YamlViewer = () => {
  const [yamlData, setYamlData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingPath, setEditingPath] = useState(null);
  const [editValue, setEditValue] = useState('');

  // YAML parser with support for proper indentation and multi-line values
  const parseYaml = (yamlText) => {
    const lines = yamlText.split('\n');
    const result = {};
    let i = 0;
    
    const parseLevel = (baseIndent = 0) => {
      const obj = {};
      
      while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          i++;
          continue;
        }
        
        const indent = line.length - line.trimStart().length;
        
        // If we've gone back to a previous indentation level, return
        if (indent < baseIndent) {
          break;
        }
        
        // Skip lines that are more indented than expected for this level
        if (indent > baseIndent) {
          i++;
          continue;
        }
        
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) {
          i++;
          continue;
        }
        
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        
        // Handle multi-line literal blocks (|)
        if (value === '|') {
          i++; // Move to next line
          const multilineValue = [];
          const expectedIndent = baseIndent + 2; // Multi-line content should be indented
          
          while (i < lines.length) {
            const nextLine = lines[i];
            const nextTrimmed = nextLine.trim();
            const nextIndent = nextLine.length - nextLine.trimStart().length;
            
            // If we hit an empty line, add it to preserve formatting
            if (!nextTrimmed) {
              multilineValue.push('');
              i++;
              continue;
            }
            
            // If we hit a comment, skip it
            if (nextTrimmed.startsWith('#')) {
              i++;
              continue;
            }
            
            // If we hit a line that's not indented enough, we're done with multi-line
            if (nextIndent <= baseIndent) {
              break;
            }
            
            // Add the line (removing the expected indentation)
            multilineValue.push(nextLine.substring(expectedIndent) || nextTrimmed);
            i++;
          }
          
          obj[key] = multilineValue.join('\n').trimEnd();
          continue;
        }
        
        // Handle nested objects
        if (value === '' || value === '{}') {
          i++; // Move to next line
          obj[key] = parseLevel(baseIndent + 2); // Expect 2-space indentation
        } else {
          // Handle simple key-value pairs
          let parsedValue = value;
          
          // Try to parse as number
          if (!isNaN(value) && value !== '') {
            parsedValue = Number(value);
          }
          // Try to parse as boolean
          else if (value === 'true') {
            parsedValue = true;
          } else if (value === 'false') {
            parsedValue = false;
          }
          // Remove quotes if present
          else if ((value.startsWith('"') && value.endsWith('"')) || 
                   (value.startsWith("'") && value.endsWith("'"))) {
            parsedValue = value.slice(1, -1);
          }
          
          obj[key] = parsedValue;
          i++;
        }
      }
      
      return obj;
    };
    
    return parseLevel(0);
  };

  const handleFileUpload = (file) => {
    if (!file.name.toLowerCase().endsWith('.yaml') && !file.name.toLowerCase().endsWith('.yml')) {
      setError('Please upload a YAML file (.yaml or .yml)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const yamlText = e.target.result;
        const parsed = parseYaml(yamlText);
        setYamlData(parsed);
        setFileName(file.name);
        setError('');
      } catch (err) {
        setError('Error parsing YAML file: ' + err.message);
        setYamlData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const clearFile = () => {
    setYamlData(null);
    setFileName('');
    setError('');
    setEditingPath(null);
    setEditValue('');
  };

  // Helper function to get nested value by path
  const getValueByPath = (obj, path) => {
    return path.reduce((current, key) => current?.[key], obj);
  };

  // Helper function to set nested value by path
  const setValueByPath = (obj, path, value) => {
    const newObj = JSON.parse(JSON.stringify(obj)); // Deep clone
    let current = newObj;
    
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    
    current[path[path.length - 1]] = value;
    return newObj;
  };

  const startEditing = (path, currentValue) => {
    setEditingPath(path);
    setEditValue(String(currentValue));
  };

  const saveEdit = () => {
    if (!editingPath) return;
    
    let parsedValue = editValue;
    
    // Try to parse the value to the appropriate type
    if (editValue === 'true') {
      parsedValue = true;
    } else if (editValue === 'false') {
      parsedValue = false;
    } else if (!isNaN(editValue) && editValue.trim() !== '') {
      parsedValue = Number(editValue);
    }
    
    const newData = setValueByPath(yamlData, editingPath, parsedValue);
    setYamlData(newData);
    setEditingPath(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingPath(null);
    setEditValue('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Convert the data back to YAML format
  const generateYaml = (obj, indent = 0) => {
    const spaces = '  '.repeat(indent);
    let yaml = '';
    
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        yaml += `${spaces}${key}:\n`;
        yaml += generateYaml(value, indent + 1);
      } else if (typeof value === 'string' && value.includes('\n')) {
        // Multi-line string - use literal block scalar
        yaml += `${spaces}${key}: |\n`;
        const lines = value.split('\n');
        lines.forEach(line => {
          yaml += `${spaces}  ${line}\n`;
        });
      } else {
        // Simple value - handle different types properly
        let yamlValue;
        if (typeof value === 'string') {
          // Check if string needs quoting (contains special chars, starts with special chars, etc.)
          if (value === '' || 
              /^[\d\-+]/.test(value) || 
              ['true', 'false', 'null', 'yes', 'no', 'on', 'off'].includes(value.toLowerCase()) ||
              /[:\[\]{},#&*!|>'"%@`]/.test(value) ||
              value.trim() !== value) {
            yamlValue = `"${value.replace(/"/g, '\\"')}"`;
          } else {
            yamlValue = value;
          }
        } else if (typeof value === 'boolean') {
          yamlValue = value ? 'true' : 'false';
        } else if (typeof value === 'number') {
          yamlValue = String(value);
        } else if (value === null || value === undefined) {
          yamlValue = 'null';
        } else {
          yamlValue = String(value);
        }
        yaml += `${spaces}${key}: ${yamlValue}\n`;
      }
    });
    
    return yaml;
  };

  const downloadYaml = () => {
    if (!yamlData || !fileName) return;
    
    const yamlContent = generateYaml(yamlData);
    const blob = new Blob([yamlContent], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderValue = (value, depth = 0, path = []) => {
    if (typeof value === 'object' && value !== null) {
      return (
        <div className="ml-4 border-l-2 border-gray-200 pl-4 mt-2">
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="mb-2">
              <span className="font-medium text-blue-600">{key}:</span>
              {renderValue(val, depth + 1, [...path, key])}
            </div>
          ))}
        </div>
      );
    }
    
    const currentPath = path;
    const isEditing = editingPath && JSON.stringify(editingPath) === JSON.stringify(currentPath);
    
    // Handle multi-line strings
    const isMultiline = typeof value === 'string' && value.includes('\n');
    
    // Handle empty/null values
    const isEmpty = value === null || value === undefined || value === '';
    
    if (isEditing) {
      return (
        <div className="inline-flex items-start ml-2 gap-2">
          {isMultiline ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  saveEdit();
                } else if (e.key === 'Escape') {
                  cancelEdit();
                }
              }}
              className="px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-20 w-64 font-mono"
              autoFocus
              placeholder="Use Ctrl+Enter to save, Escape to cancel"
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyPress}
              className="px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              placeholder="Enter a value"
            />
          )}
          <button
            onClick={saveEdit}
            className="text-green-600 hover:text-green-800 transition-colors mt-1"
            title={isMultiline ? "Save (Ctrl+Enter)" : "Save (Enter)"}
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={cancelEdit}
            className="text-red-600 hover:text-red-800 transition-colors mt-1"
            title="Cancel (Escape)"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      );
    }
    
    // Handle empty values
    if (isEmpty) {
      return (
        <div className="inline-flex items-center ml-2 group">
          <span className="text-gray-400 italic">
            (empty)
          </span>
          <button
            onClick={() => startEditing(currentPath, '')}
            className="ml-2 text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
            title="Add value"
          >
            <Edit2 className="h-3 w-3" />
          </button>
        </div>
      );
    }
    
    if (isMultiline) {
      return (
        <div className="inline-flex items-start ml-2 group">
          <div className="bg-gray-100 rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap max-w-md border">
            {value}
          </div>
          <button
            onClick={() => startEditing(currentPath, value)}
            className="ml-2 text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100 mt-1"
            title="Edit multi-line value"
          >
            <Edit2 className="h-3 w-3" />
          </button>
        </div>
      );
    }
    
    return (
      <div className="inline-flex items-center ml-2 group">
        <span className={`${
          typeof value === 'string' ? 'text-green-600' :
          typeof value === 'number' ? 'text-purple-600' :
          typeof value === 'boolean' ? 'text-orange-600' :
          'text-gray-600'
        }`}>
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
        <button
          onClick={() => startEditing(currentPath, value)}
          className="ml-2 text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
          title="Edit value"
        >
          <Edit2 className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          YAML File Viewer
        </h1>
        
        {!yamlData ? (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg text-gray-600 mb-4">
                Drag and drop your YAML file here, or click to browse
              </p>
              <input
                type="file"
                accept=".yaml,.yml"
                onChange={handleFileInput}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Choose File
              </label>
            </div>
            
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-lg">
            <div className="border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-blue-500 mr-2" />
                <span className="font-medium text-gray-700">{fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadYaml}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                  title="Download edited YAML file"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  onClick={clearFile}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Clear file"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                YAML Content
              </h2>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm overflow-auto">
                {Object.entries(yamlData).map(([key, value]) => (
                  <div key={key} className="mb-3">
                    <span className="font-medium text-blue-600">{key}:</span>
                    {renderValue(value, 0, [key])}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default YamlViewer;