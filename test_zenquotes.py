import aiohttp
import asyncio

async def test_zenquotes_api():
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get('https://zenquotes.io/api/random') as response:
                print(f'Status: {response.status}')
                if response.status == 200:
                    data = await response.json()
                    print(f'Response: {data}')
                    if isinstance(data, list) and len(data) > 0:
                        quote_data = data[0]
                        print(f'Quote: "{quote_data.get("q", "N/A")}"')
                        print(f'Author: {quote_data.get("a", "N/A")}')
                    else:
                        print('Unexpected response format')
                else:
                    print(f'Error: HTTP {response.status}')
    except Exception as e:
        print(f'Error: {e}')

if __name__ == "__main__":
    asyncio.run(test_zenquotes_api())
