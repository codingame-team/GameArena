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
    <div style={{display: 'flex', flex: 1, minHeight: 0, border: '1px solid #ddd'}}>
      <Editor
        height="100%"
        theme={monacoTheme}
        defaultLanguage={language}
        defaultValue={value}
        value={value}
        onChange={(v)=> onChange(v)}
        options={editorOptions}
      />
    </div>
  )
}

