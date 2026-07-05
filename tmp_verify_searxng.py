import asyncio
from app.web.search import SearXNGClient

async def main():
    client = SearXNGClient('http://127.0.0.1:8080')
    try:
        data = await client.search('latest pricing changes OpenAI', limit=3)
        print('count', len(data))
        for item in data[:3]:
            print(item)
    except Exception as e:
        print('ERR', type(e).__name__, e)

asyncio.run(main())
