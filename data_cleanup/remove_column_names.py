import pandas as pd

df = pd.read_csv("diet.csv", sep=";")

# remove repeated headers
df = df[df["Datum"] != "Datum"]

# save cleaned CSV
df.to_csv("diet_clean.csv", sep=";", index=False, encoding="utf-8-sig")