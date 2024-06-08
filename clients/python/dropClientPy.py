import requests
import json
from typing import List, Optional

class TransfersClient:
    def __init__(self, base_url: str, auth_key: str):
        self.base_url = base_url
        self.headers = {
            'Content-Type': 'application/json',
            'Authorization': f'{auth_key}'
        }

    def post_transfer(self, transfers: List[dict]) -> List[str]:
        url = f'{self.base_url}/transfer'
        response = requests.post(url, headers=self.headers, data=json.dumps(transfers))
        response.raise_for_status()
        return response.json().get('transferIds', [])

    def get_transfer_by_id(self, transfer_id: str) -> dict:
        url = f'{self.base_url}/transfer/{transfer_id}'
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def get_transfers(self, application: Optional[str] = None, receiver: Optional[str] = None,
                      sender: Optional[str] = None, memo: Optional[str] = None,
                      status: Optional[str] = None, sort_by_time: Optional[str] = 'asc') -> List[dict]:
        params = {
            'application': application,
            'receiver': receiver,
            'sender': sender,
            'memo': memo,
            'status': status,
            'sort_by_time': sort_by_time
        }
        params = {k: v for k, v in params.items() if v is not None}
        url = f'{self.base_url}/transfers'
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()

# Example usage:
if __name__ == "__main__":
    base_url = "http://localhost:3000"
    auth_key = "private_key_for_app1234"

    client = TransfersClient(base_url, auth_key)

    # Post a transfer
    transfers = [
        {
            "receiver": "crptomonkeys",
            "memo": "Test transfer py"
        },
    ]

    try:
        transfer_ids = client.post_transfer(transfers)
        print(f"Posted transfers with IDs: {transfer_ids}")

        # Get a transfer by ID
        for transfer_id in transfer_ids:
            transfer = client.get_transfer_by_id(transfer_id)
            print(f"Transfer {transfer_id}: {transfer}")

        # Get transfers with filters
        filtered_transfers = client.get_transfers(application="local_test_app", sort_by_time="desc")
        print(f"Filtered transfers: {filtered_transfers}")
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
