use serde::{Deserialize, Serialize};
use serde_json::json;
use spin_sdk::{
    http::{Request, Response},
    http_component,
    key_value::Store,
};

// Define a serializable User type
#[derive(Serialize, Deserialize)]
struct User {
    fingerprint: String,
    location: String,
}

#[http_component]
fn handle_request(_req: Request) -> anyhow::Result<Response> {
    // Open the default key-value store
    let store = Store::open_default()?;
    let retrieved_user: Option<User> = match store.get_json("my_json") {
        Ok(user) => user,
        Err(e) => {
            eprintln!("Error: {:?}", e);
            None
        }
    };

    if let Some(user) = retrieved_user {
        return Ok(Response::builder()
            .status(200)
            .body(serde_json::to_string(&user).unwrap())
            .build());
    }
    // Create an instance of a User object and populate the values
    let user = User {
        fingerprint: "0x1234".to_owned(),
        location: "Brisbane".to_owned(),
    };
    // Store the User object using the "my_json" key
    store.set_json("my_json", &user)?;
    // Retrieve the user object from the key-value store, using the "my_json" key
    Ok(Response::builder()
        .status(200)
        .body(serde_json::to_string(&json!({"status": "created new user"})).unwrap())
        .build())
}
