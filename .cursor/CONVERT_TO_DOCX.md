# Converting Agent Documentation to .docx

The agent capabilities documentation has been created as a Markdown file:
`.cursor/Agent_Capabilities_Documentation.md`

## Option 1: Using Pandoc (Recommended)

If you have `pandoc` installed:

```bash
pandoc .cursor/Agent_Capabilities_Documentation.md -o .cursor/Agent_Capabilities_Documentation.docx
```

Install pandoc:
- macOS: `brew install pandoc`
- Linux: `sudo apt-get install pandoc` or `sudo yum install pandoc`
- Windows: Download from https://pandoc.org/installing.html

## Option 2: Using Python Script

If you have `python-docx` installed:

```bash
# Install python-docx first
pip install python-docx

# Run the generator script
python3 .cursor/generate_agent_docs.py
```

This will create: `.cursor/Agent_Capabilities_Documentation.docx`

## Option 3: Using Microsoft Word / LibreOffice

1. Open Microsoft Word or LibreOffice Writer
2. File → Open → Select `.cursor/Agent_Capabilities_Documentation.md`
3. Word/LibreOffice will import the markdown
4. File → Save As → Choose `.docx` format

## Option 4: Using Online Converters

1. Upload `.cursor/Agent_Capabilities_Documentation.md` to:
   - https://cloudconvert.com/md-to-docx
   - https://www.zamzar.com/convert/md-to-docx/
   - https://convertio.co/md-docx/
2. Download the converted `.docx` file

## Option 5: Using Docker Container

If your Docker containers are running:

```bash
# Install python-docx in the container
docker compose exec core-svc pip install python-docx

# Copy the script to the container
docker compose cp .cursor/generate_agent_docs.py core-svc:/tmp/

# Run it
docker compose exec core-svc python3 /tmp/generate_agent_docs.py

# Copy the result back
docker compose cp core-svc:/tmp/Agent_Capabilities_Documentation.docx .cursor/
```

---

**Note:** The markdown file (`.md`) is already well-formatted and can be used directly. Most modern editors and viewers support markdown rendering.
