from pymongo import MongoClient
from collections import Counter

uri = 'mongodb://localhost:27017/br10'
client = MongoClient(uri, serverSelectionTimeoutMS=3000)
db = client.get_default_database()
logs = list(db.logs.find({}, {'level':1, 'category':1, 'message':1, 'date':1}).sort('date', -1).limit(20))
print('TOTAL_LOGS', db.logs.count_documents({}))
print('LEVELS', Counter((doc.get('level') or 'missing') for doc in db.logs.find({}, {'level':1})))
print('CATEGORIES', Counter((doc.get('category') or 'missing') for doc in db.logs.find({}, {'category':1})))
print('SAMPLE')
for doc in logs:
    print(doc.get('date'), doc.get('level'), doc.get('category'), doc.get('message'))
