import asyncio, json, os
from mcp.client.stdio import StdioServerParameters, connect_stdio
from mcp.client.session import ClientSession

# Ensure the server sees the DB url
os.environ.setdefault("DATABASE_URL", os.getenv("DATABASE_URL", "postgresql://leadai:leadai@localhost:5432/leadai"))

async def main():
    params = StdioServerParameters(
        command="python",
        args=["apps/mcp/score_mcp_server.py"],
        env=os.environ.copy(),
    )
    async with connect_stdio(params) as (read, write):
        async with ClientSession(read, write) as session:
            tools = await session.list_tools()
            print("TOOLS:", [t.name for t in tools.tools])

            # Change the project slug if needed
            args = {"project": "ai-document-processing", "verbose": True}

            # Try KPI recompute
            r1 = await session.call_tool("recompute_kpis", arguments=args)
            print("recompute_kpis ->", getattr(r1, "content", r1))

            # Try pillar recompute
            r2 = await session.call_tool("recompute_pillars", arguments=args)
            print("recompute_pillars ->", getattr(r2, "content", r2))

            # Try full recompute
            r3 = await session.call_tool("recompute_all", arguments=args)
            print("recompute_all ->", getattr(r3, "content", r3))

if __name__ == "__main__":
    asyncio.run(main())
