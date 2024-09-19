package main

import (
    "fmt"
    "log"
    "os"

    "github.com/go-resty/resty/v2"
)

type Transfer struct {
    Sender      string `json:"sender"`
    Receiver    string `json:"receiver"`
    Memo        string `json:"memo"`
    Application string `json:"application"`
}

type TransfersClient struct {
    client *resty.Client
}

func NewTransfersClient(baseUrl, authKey string) *TransfersClient {
    client := resty.New().
        SetHostURL(baseUrl).
        SetHeader("Content-Type", "application/json").
        SetAuthToken(authKey)

    return &TransfersClient{client: client}
}

func (c *TransfersClient) PostTransfer(transfers []Transfer) ([]string, error) {
    var result map[string][]string
    _, err := c.client.R().
        SetBody(transfers).
        SetResult(&result).
        Post("/transfer")
    if err != nil {
        return nil, err
    }
    return result["transferIds"], nil
}

func (c *TransfersClient) GetTransferById(transferId string) (*Transfer, error) {
    var transfer Transfer
    _, err := c.client.R().
        SetResult(&transfer).
        Get(fmt.Sprintf("/transfer/%s", transferId))
    if err != nil {
        return nil, err
    }
    return &transfer, nil
}

func (c *TransfersClient) GetTransfers(params map[string]string) ([]Transfer, error) {
    var transfers []Transfer
    req := c.client.R().SetResult(&transfers)
    for k, v := range params {
        req.SetQueryParam(k, v)
    }
    _, err := req.Get("/transfers")
    if err != nil {
        return nil, err
    }
    return transfers, nil
}

func main() {
    baseUrl := "http://localhost:3000"
    authKey := "your_auth_key"
    client := NewTransfersClient(baseUrl, authKey)

    transfers := []Transfer{
        {Sender: "user1", Receiver: "user2", Memo: "Test transfer", Application: "app1"},
        {Sender: "user3", Receiver: "user4", Memo: "Another test transfer", Application: "app2"},
    }

    transferIds, err := client.PostTransfer(transfers)
    if err != nil {
        log.Fatalf("Failed to post transfers: %v", err)
    }
    fmt.Printf("Posted transfers with IDs: %v\n", transferIds)

    for _, transferId := range transferIds {
        transfer, err := client.GetTransferById(transferId)
        if err != nil {
            log.Fatalf("Failed to get transfer by ID %s: %v", transferId, err)
        }
        fmt.Printf("Transfer %s: %+v\n", transferId, transfer)
    }

    params := map[string]string{
        "application": "app1",
        "sort_by_time": "desc",
    }
    filteredTransfers, err := client.GetTransfers(params)
    if err != nil {
        log.Fatalf("Failed to get filtered transfers: %v", err)
    }
    fmt.Printf("Filtered transfers: %+v\n", filteredTransfers)
}
