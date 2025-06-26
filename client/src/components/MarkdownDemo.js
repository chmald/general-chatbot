import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MarkdownDemo = () => {
  const sampleMarkdown = `
# Welcome to Markdown Chat!

This chatbot now supports **full markdown formatting**!

## Features Supported:

- **Bold text** and *italic text*
- \`inline code\` and code blocks
- Lists (both ordered and unordered)
- Tables
- Blockquotes
- Links and more!

### Code Example:
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

### Table Example:
| Feature | Supported | Notes |
|---------|-----------|-------|
| Headers | ✅ | H1-H6 |
| Lists | ✅ | Ordered & Unordered |
| Code | ✅ | Inline & Blocks |
| Tables | ✅ | With styling |

> **Note**: This is a blockquote showing how quoted text appears in the chat.

### Links
Visit [OpenAI](https://openai.com) for more information about AI.

---

Try sending a message with markdown formatting to see it in action!
  `;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Markdown Rendering Demo</h2>
      <div style={{ 
        background: '#f1f3f4', 
        padding: '20px', 
        borderRadius: '12px',
        border: '1px solid #e8eaed'
      }}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            code({node, inline, className, children, ...props}) {
              return inline ? (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              ) : (
                <pre className="code-block">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            },
            blockquote({children, ...props}) {
              return (
                <blockquote className="markdown-blockquote" {...props}>
                  {children}
                </blockquote>
              );
            },
            table({children, ...props}) {
              return (
                <div className="table-wrapper">
                  <table className="markdown-table" {...props}>
                    {children}
                  </table>
                </div>
              );
            },
            ul({children, ...props}) {
              return (
                <ul className="markdown-list" {...props}>
                  {children}
                </ul>
              );
            },
            ol({children, ...props}) {
              return (
                <ol className="markdown-list ordered" {...props}>
                  {children}
                </ol>
              );
            }
          }}
        >
          {sampleMarkdown}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownDemo;
