import React from 'react'
import Editor from '@monaco-editor/react'

export default function MonacoEditor({value, onChange, language='python'}){
  return (
    <div style={{height: '360px', border: '1px solid #ddd'}}>
      <Editor
        height="100%"
        defaultLanguage={language}
        defaultValue={value}
        value={value}
        onChange={(v)=> onChange(v)}
        options={{ minimap: { enabled: false }, fontSize: 13 }}
      />
    </div>
  )
}

