Firestore rules
```console
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Global default: public read, no default writes.
    match /{document=**} {
      allow read: if true;
    }

    // Polls: signed-in users can create; only the creator can update/delete.
    match /polls/{pollId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
                            && request.auth.uid == resource.data.createdBy;
    }

    // Add more per-collection write rules here as needed.
  }
}
```