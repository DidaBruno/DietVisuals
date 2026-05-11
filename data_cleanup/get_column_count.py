import pandas as pd

# read CSV
df = pd.read_csv("diet_clean_zeros.csv", sep=";")

# number of elements (non-null values) per column
for column in df.columns:
    print(f"{column}: {df[column].notna().sum()} elemenata")

# total number of rows
print("\nUkupan broj redaka:", len(df))