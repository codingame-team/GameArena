import React from 'react'
import Editor from '@monaco-editor/react'

export default function MonacoEditor({value, onChange, language='python', theme='light', options={}}){
  // choose monaco theme
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs'
  
  // Merge default options with provided options
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 13,
    ...options
  }
  
  // make the editor fill its container; parent should provide sizing (flex/minHeight)
  return (
    <div style={{
      flex: 1, 
      minHeight: 0, 
      border: '1px solid #ddd',
      height: '100%',
      position: 'relative'
    }}>
      <Editor
        height="100%"
        theme={monacoTheme}
        language={language}
        value={value}
        onChange={(v)=> onChange && onChange(v)}
        options={editorOptions}
      />
    </div>
  )
}

