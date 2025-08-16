Firestore rules
```console
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Public read by default
    match /{document=**} {
      allow read: if true;
    }

    match /polls/{pollId} {
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
                            && request.auth.uid == resource.data.createdBy;

      // Questions subcollection
      match /questions/{questionId} {
        allow read: if true;
        allow create, update, delete: if request.auth != null
                                      && request.auth.uid == get(/databases/$(database)/documents/polls/$(pollId)).data.createdBy;
      }
    }
  }
}

```